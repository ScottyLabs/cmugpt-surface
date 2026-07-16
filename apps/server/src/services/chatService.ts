import type { InferSelectModel } from "drizzle-orm";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../db/index.ts";
import { chats, messages } from "../db/schema.ts";
import { callAgent, streamAgent } from "../lib/agentClient.ts";
import { agentUserId } from "../lib/agentUserId.ts";
import { BadRequestError, NotFoundError } from "../middlewares/errorHandler.ts";
import { userPreferencesService } from "./userPreferencesService.ts";

const DEFAULT_CHAT_TITLE = "New chat";

function titleFromFirstMessage(content: string): string {
  const line = content.trim().split("\n")[0]?.trim() ?? "";
  if (!line) {
    return DEFAULT_CHAT_TITLE;
  }
  if (line.length <= 80) {
    return line;
  }
  return `${line.slice(0, 77)}...`;
}

export interface ChatListItemDto {
  id: string;
  title: string;
  starred: boolean;
  isPublic: boolean;
  updatedAt: string;
}

export interface ChatDetailDto extends ChatListItemDto {
  isOwner: boolean;
}

export interface CmuMapsDto {
  url: string | null;
  mode: string | null;
  target: string | null;
  targetLabel: string | null;
  src: string | null;
  srcLabel: string | null;
  dest: string | null;
  destLabel: string | null;
}

export interface MessageDto {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  cmuMaps?: CmuMapsDto | null;
  /** Agent confidence for the just-generated turn. Not persisted; only set on
   *  fresh assistant messages, undefined when re-reading history. */
  confidence?: number;
}

export interface PostMessageResultDto {
  userMessage: MessageDto;
  assistantMessage: MessageDto;
}

export type ChatStreamEvent =
  | { type: "user"; message: MessageDto }
  | { type: "status"; text: string }
  | {
      type: "memory";
      op: "add" | "remove";
      text: string;
      id?: string;
      kind?: "learned" | "remembered";
      fact?: string;
    }
  | { type: "map"; cmuMaps: CmuMapsDto }
  | { type: "delta"; text: string }
  | { type: "done"; message: MessageDto }
  | { type: "error"; message: string };

type MessageRow = InferSelectModel<typeof messages>;

function messageRowToDto(row: MessageRow): MessageDto {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    cmuMaps: row.cmuMaps ?? null,
  };
}

async function getOwnedChat(chatId: string, userSub: string) {
  const [row] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userSub, userSub)))
    .limit(1);
  return row;
}

type ChatRow = InferSelectModel<typeof chats>;

async function getReadableChat(
  chatId: string,
  userSub: string,
): Promise<ChatRow | undefined> {
  const [row] = await db
    .select()
    .from(chats)
    .where(
      and(
        eq(chats.id, chatId),
        or(eq(chats.userSub, userSub), eq(chats.isPublic, true)),
      ),
    )
    .limit(1);
  return row;
}

function chatRowToListDto(row: ChatRow): ChatListItemDto {
  return {
    id: row.id,
    title: row.title,
    starred: row.starred,
    isPublic: row.isPublic,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Persist user message, refresh chat title if needed, return rows for agent context. */
async function prepareAssistantTurn(
  chatId: string,
  userSub: string,
  content: string,
): Promise<{
  userRow: MessageRow;
  messageHistory: { role: string; content: string }[];
}> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new BadRequestError("Message content is required");
  }

  const chat = await getOwnedChat(chatId, userSub);
  if (!chat) {
    throw new NotFoundError("Chat not found");
  }

  const [userRow] = await db
    .insert(messages)
    .values({
      chatId,
      role: "user",
      content: trimmed,
    })
    .returning();

  if (chat.title === DEFAULT_CHAT_TITLE) {
    await db
      .update(chats)
      .set({ title: titleFromFirstMessage(trimmed), updatedAt: new Date() })
      .where(eq(chats.id, chatId));
  } else {
    await db
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, chatId));
  }

  // Build message history from prior messages (excluding the one we just inserted).
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt))
    .limit(200);

  const messageHistory = history
    .filter((m) => m.id !== userRow?.id)
    .map((m) => ({ role: m.role, content: m.content }));

  if (!userRow) {
    throw new Error("Failed to persist user message");
  }

  return { userRow, messageHistory };
}

export const chatService = {
  async listChats(userSub: string, q?: string): Promise<ChatListItemDto[]> {
    const owner = eq(chats.userSub, userSub);
    const whereClause = q?.trim()
      ? and(owner, ilike(chats.title, `%${q.trim()}%`))
      : owner;
    const rows = await db
      .select()
      .from(chats)
      .where(whereClause)
      .orderBy(desc(chats.updatedAt));
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
    if (!row) {
      throw new Error("Failed to create chat");
    }
    return chatRowToListDto(row);
  },

  async getMessages(chatId: string, userSub: string): Promise<MessageDto[]> {
    const chat = await getReadableChat(chatId, userSub);
    if (!chat) {
      throw new NotFoundError("Chat not found");
    }
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(asc(messages.createdAt))
      .limit(200);
    return rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      cmuMaps: m.cmuMaps ?? null,
    }));
  },

  async postMessage(
    chatId: string,
    userSub: string,
    content: string,
  ): Promise<PostMessageResultDto> {
    const { userRow, messageHistory } = await prepareAssistantTurn(
      chatId,
      userSub,
      content,
    );

    const preferredModel =
      await userPreferencesService.getPreferredModel(userSub);
    const agentResult = await callAgent({
      query: content.trim(),
      ...(messageHistory.length > 0 && { messageHistory }),
      userId: agentUserId(userSub),
      model: preferredModel,
    });

    const [assistantRow] = await db
      .insert(messages)
      .values({
        chatId,
        role: "assistant",
        content: agentResult.text,
        cmuMaps: agentResult.cmuMaps ?? null,
      })
      .returning();

    await db
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, chatId));

    if (!assistantRow) {
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
    options: { signal?: AbortSignal } = {},
  ): AsyncGenerator<ChatStreamEvent, void, undefined> {
    const { userRow, messageHistory } = await prepareAssistantTurn(
      chatId,
      userSub,
      content,
    );

    yield { type: "user", message: messageRowToDto(userRow) };

    const preferredModel =
      await userPreferencesService.getPreferredModel(userSub);
    let result: Awaited<ReturnType<typeof callAgent>> | undefined;
    let streamedText = "";
    let streamedCmuMaps: CmuMapsDto | null = null;
    try {
      for await (const ev of streamAgent(
        {
          query: content.trim(),
          ...(messageHistory.length > 0 && { messageHistory }),
          userId: agentUserId(userSub),
          model: preferredModel,
        },
        options.signal,
      )) {
        if (ev.type === "status") {
          yield { type: "status", text: ev.text };
        } else if (ev.type === "memory") {
          yield ev;
        } else if (ev.type === "map") {
          streamedCmuMaps = ev.cmuMaps;
          yield { type: "map", cmuMaps: ev.cmuMaps };
        } else if (ev.type === "delta") {
          streamedText += ev.text;
          yield { type: "delta", text: ev.text };
        } else if (ev.type === "done") {
          ({ result } = ev);
        } else if (ev.type === "error") {
          yield { type: "error", message: ev.message };
          return;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Agent request failed";
      yield { type: "error", message: msg };
      return;
    }

    if (!result) {
      if (!streamedText.trim()) {
        yield {
          type: "error",
          message: "Agent stream ended without a response",
        };
        return;
      }
      result = { text: streamedText };
    } else if (!streamedText) {
      yield { type: "delta", text: result.text };
    }
    if (result.cmuMaps && !streamedCmuMaps) {
      streamedCmuMaps = result.cmuMaps;
      yield { type: "map", cmuMaps: result.cmuMaps };
    }

    const [assistantRow] = await db
      .insert(messages)
      .values({
        chatId,
        role: "assistant",
        content: result.text,
        cmuMaps: result.cmuMaps ?? streamedCmuMaps,
      })
      .returning();

    await db
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, chatId));

    if (!assistantRow) {
      yield { type: "error", message: "Failed to persist assistant message" };
      return;
    }

    const finalMessage: MessageDto = messageRowToDto(assistantRow);
    if (typeof result.confidence === "number") {
      finalMessage.confidence = result.confidence;
    }
    yield { type: "done", message: finalMessage };
  },

  async patchChat(
    chatId: string,
    userSub: string,
    body: { starred?: boolean; title?: string; isPublic?: boolean },
  ): Promise<ChatListItemDto> {
    if (
      body.starred === undefined &&
      body.title === undefined &&
      body.isPublic === undefined
    ) {
      throw new BadRequestError("Provide starred, title, and/or isPublic");
    }

    const chat = await getOwnedChat(chatId, userSub);
    if (!chat) {
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

    const [row] = await db
      .update(chats)
      .set(patch)
      .where(eq(chats.id, chatId))
      .returning();
    if (!row) {
      throw new NotFoundError("Chat not found");
    }
    return chatRowToListDto(row);
  },

  async deleteChat(chatId: string, userSub: string): Promise<void> {
    const chat = await getOwnedChat(chatId, userSub);
    if (!chat) {
      throw new NotFoundError("Chat not found");
    }
    await db.delete(chats).where(eq(chats.id, chatId));
  },

  async getChat(chatId: string, userSub: string): Promise<ChatDetailDto> {
    const row = await getReadableChat(chatId, userSub);
    if (!row) {
      throw new NotFoundError("Chat not found");
    }
    return {
      ...chatRowToListDto(row),
      isOwner: row.userSub === userSub,
    };
  },
};
