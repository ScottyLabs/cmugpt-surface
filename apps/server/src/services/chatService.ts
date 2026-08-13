import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { db } from "../db/index.ts";
import { chats, messages } from "../db/schema.ts";
import { callAgent } from "../lib/agentClient.ts";
import { agentUserId } from "../lib/agentUserId.ts";
import { BadRequestError, NotFoundError } from "../middlewares/errorHandler.ts";
import {
  chatRowToListDto,
  DEFAULT_CHAT_TITLE,
  finalizeAssistantMessage,
  getOwnedChat,
  getReadableChat,
  messageRowToDto,
  prepareAssistantTurn,
  runAgentStream,
  upgradeChatTitle,
} from "./chatService.helpers.ts";
import type {
  ChatDetailDto,
  ChatListItemDto,
  ChatStreamEvent,
  MessageDto,
  PostMessageResultDto,
  SavedMemoryDto,
} from "./chatService.types.ts";
import { userPreferencesService } from "./userPreferencesService.ts";

export type {
  ChatDetailDto,
  ChatListItemDto,
  ChatStreamEvent,
  CmuMapsDto,
  MessageDto,
  PostMessageResultDto,
} from "./chatService.types.ts";

export const chatService = {
  async listChats(userSub: string, q?: string): Promise<ChatListItemDto[]> {
    const owner = eq(chats.userSub, userSub);
    const trimmedQuery = q?.trim();
    const whereClause =
      trimmedQuery !== undefined && trimmedQuery !== ""
        ? and(owner, ilike(chats.title, `%${trimmedQuery}%`))
        : owner;
    const rows = await db.select().from(chats).where(whereClause).orderBy(desc(chats.updatedAt));
    return rows.map((r) => chatRowToListDto(r));
  },

  async createChat(userSub: string): Promise<ChatListItemDto> {
    const [row] = await db
      .insert(chats)
      .values({
        userSub,
        title: DEFAULT_CHAT_TITLE,
        starred: false,
      })
      .returning();
    if (row === undefined) {
      throw new Error("Failed to create chat");
    }
    return chatRowToListDto(row);
  },

  async getMessages(chatId: string, userSub: string): Promise<MessageDto[]> {
    const chat = await getReadableChat(chatId, userSub);
    if (chat === undefined) {
      throw new NotFoundError("Chat not found");
    }
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(asc(messages.createdAt))
      .limit(200);
    return rows.map(messageRowToDto);
  },

  /** Attach (or clear, with null) the saved-memory chip on one message.
   *
   * Used for self-learned facts, which the agent stores a few seconds after
   * the turn ends, past the point the streamed answer could carry them, and
   * to clear the chip when its memory is deleted. Only the chat owner may
   * write, and the message must belong to that chat.
   */
  async setMessageSavedMemory(
    chatId: string,
    userSub: string,
    messageId: string,
    savedMemory: SavedMemoryDto | null,
  ): Promise<void> {
    const chat = await getOwnedChat(chatId, userSub);
    if (chat === undefined) {
      throw new NotFoundError("Chat not found");
    }
    const [updated] = await db
      .update(messages)
      .set({ savedMemory })
      .where(and(eq(messages.id, messageId), eq(messages.chatId, chatId)))
      .returning({ id: messages.id });
    if (updated === undefined) {
      throw new NotFoundError("Message not found");
    }
  },

  async postMessage(
    chatId: string,
    userSub: string,
    content: string,
  ): Promise<PostMessageResultDto> {
    const { userRow, messageHistory, titledByThisMessage } = await prepareAssistantTurn(
      chatId,
      userSub,
      content,
    );

    // One-time title upgrade, concurrent with the agent call. The agent
    // moderates the message itself and titles flagged ones "New chat".
    const titlePromise = titledByThisMessage
      ? upgradeChatTitle(chatId, content.trim()).catch(() => {})
      : undefined;

    const preferredModel = await userPreferencesService.getPreferredModel(userSub);
    const agentResult = await callAgent({
      query: content.trim(),
      ...(messageHistory.length > 0 && { messageHistory }),
      userId: agentUserId(userSub),
      model: preferredModel,
    });

    await titlePromise;

    const [assistantRow] = await db
      .insert(messages)
      .values({
        chatId,
        role: "assistant",
        content: agentResult.text,
        cmuMaps: agentResult.cmuMaps ?? null,
      })
      .returning();

    await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId));

    if (assistantRow === undefined) {
      throw new Error("Failed to persist messages");
    }

    const assistantMessage: MessageDto = messageRowToDto(assistantRow);
    if (typeof agentResult.confidence === "number") {
      assistantMessage.confidence = agentResult.confidence;
    }
    return {
      userMessage: messageRowToDto(userRow),
      assistantMessage,
    };
  },

  async *postMessageStream(
    chatId: string,
    userSub: string,
    content: string,
    options: { signal?: AbortSignal; disabledTools?: string[] } = {},
  ): AsyncGenerator<ChatStreamEvent, void, undefined> {
    const { userRow, messageHistory, titledByThisMessage } = await prepareAssistantTurn(
      chatId,
      userSub,
      content,
    );

    yield { type: "user", message: messageRowToDto(userRow) };

    // One-time title upgrade, concurrent with the agent turn: by the time the
    // stream finishes it has almost always resolved, so awaiting it below
    // adds no meaningful latency before the done event. The agent moderates
    // the message itself and titles flagged ones "New chat".
    const titlePromise = titledByThisMessage
      ? upgradeChatTitle(chatId, content.trim()).catch(() => {})
      : undefined;

    const preferredModel = await userPreferencesService.getPreferredModel(userSub);
    const { result, streamedText, streamedCmuMaps, streamedSavedMemory, errored } = yield* runAgentStream(
      content.trim(),
      messageHistory,
      userSub,
      preferredModel,
      options.disabledTools ?? [],
      options.signal,
    );
    if (errored) {
      return;
    }

    yield* finalizeAssistantMessage(chatId, result, streamedText, streamedCmuMaps, streamedSavedMemory);
    // Let the title land before the response closes, so the client's
    // post-stream refetch already sees it.
    await titlePromise;
  },

  async patchChat(
    chatId: string,
    userSub: string,
    body: { starred?: boolean; title?: string; isPublic?: boolean },
  ): Promise<ChatListItemDto> {
    if (body.starred === undefined && body.title === undefined && body.isPublic === undefined) {
      throw new BadRequestError("Provide starred, title, and/or isPublic");
    }

    const chat = await getOwnedChat(chatId, userSub);
    if (chat === undefined) {
      throw new NotFoundError("Chat not found");
    }

    const patch: {
      starred?: boolean;
      title?: string;
      isPublic?: boolean;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };
    if (body.starred !== undefined) {
      patch.starred = body.starred;
    }
    if (body.title !== undefined) {
      const t = body.title.trim();
      if (!t) {
        throw new BadRequestError("Title must be non-empty");
      }
      patch.title = t;
    }
    if (body.isPublic !== undefined) {
      patch.isPublic = body.isPublic;
    }

    const [row] = await db.update(chats).set(patch).where(eq(chats.id, chatId)).returning();
    if (row === undefined) {
      throw new NotFoundError("Chat not found");
    }
    return chatRowToListDto(row);
  },

  async deleteChat(chatId: string, userSub: string): Promise<void> {
    const chat = await getOwnedChat(chatId, userSub);
    if (chat === undefined) {
      throw new NotFoundError("Chat not found");
    }
    await db.delete(chats).where(eq(chats.id, chatId));
  },

  async getChat(chatId: string, userSub: string): Promise<ChatDetailDto> {
    const row = await getReadableChat(chatId, userSub);
    if (row === undefined) {
      throw new NotFoundError("Chat not found");
    }
    return {
      ...chatRowToListDto(row),
      isOwner: row.userSub === userSub,
    };
  },
};
