import type { InferSelectModel } from "drizzle-orm";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../db/index.ts";
import { chats, messages } from "../db/schema.ts";
import { env } from "../env.ts";
import type { ChatMessage } from "../lib/llm/chatCompletionPort.ts";
import { OpenaiCompatibleChatCompletion } from "../lib/llm/openaiCompatibleChatCompletion.ts";
import { BadRequestError, NotFoundError } from "../middlewares/errorHandler.ts";

const DEFAULT_CHAT_TITLE = "New chat";

const SYSTEM_PROMPT = `You are cmuGPT, a concise and accurate assistant focused on Carnegie Mellon University (CMU): campus, academics, student life, and Pittsburgh context. If you are unsure, say so and suggest official CMU resources where appropriate.`;

const llm = new OpenaiCompatibleChatCompletion({
  baseUrl: env.LLM_API_BASE_URL,
  apiKey: env.LLM_API_KEY,
  model: env.LLM_MODEL,
  ...(env.LLM_HTTP_REFERER !== undefined && {
    httpReferer: env.LLM_HTTP_REFERER,
  }),
  ...(env.LLM_APP_NAME !== undefined && { appName: env.LLM_APP_NAME }),
});

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

export interface MessageDto {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface PostMessageResultDto {
  userMessage: MessageDto;
  assistantMessage: MessageDto;
}

export type ChatStreamEvent =
  | { type: "user"; message: MessageDto }
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

/** Persist user message, refresh chat title if needed, return rows for LLM context. */
async function prepareAssistantTurn(
  chatId: string,
  userSub: string,
  content: string,
): Promise<{ userRow: MessageRow; llmMessages: ChatMessage[] }> {
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

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt))
    .limit(200);

  const llmMessages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role as ChatMessage["role"],
      content: m.content,
    })),
  ];

  if (!userRow) {
    throw new Error("Failed to persist user message");
  }

  return { userRow, llmMessages };
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
    }));
  },

  async postMessage(
    chatId: string,
    userSub: string,
    content: string,
  ): Promise<PostMessageResultDto> {
    const { userRow, llmMessages } = await prepareAssistantTurn(
      chatId,
      userSub,
      content,
    );

    const assistantText = await llm.complete({ messages: llmMessages });

    const [assistantRow] = await db
      .insert(messages)
      .values({
        chatId,
        role: "assistant",
        content: assistantText,
      })
      .returning();

    await db
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, chatId));

    if (!assistantRow) {
      throw new Error("Failed to persist messages");
    }

    return {
      userMessage: messageRowToDto(userRow),
      assistantMessage: messageRowToDto(assistantRow),
    };
  },

  async *postMessageStream(
    chatId: string,
    userSub: string,
    content: string,
    options: { signal?: AbortSignal } = {},
  ): AsyncGenerator<ChatStreamEvent, void, undefined> {
    const { userRow, llmMessages } = await prepareAssistantTurn(
      chatId,
      userSub,
      content,
    );

    yield { type: "user", message: messageRowToDto(userRow) };

    let full = "";
    try {
      const llmInput: { messages: ChatMessage[]; signal?: AbortSignal } = {
        messages: llmMessages,
      };
      if (options.signal !== undefined) {
        llmInput.signal = options.signal;
      }
      for await (const delta of llm.completeStream(llmInput)) {
        full += delta;
        yield { type: "delta", text: delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stream failed";
      yield { type: "error", message: msg };
      return;
    }

    if (!full.trim()) {
      yield { type: "error", message: "Empty LLM response" };
      return;
    }

    const [assistantRow] = await db
      .insert(messages)
      .values({
        chatId,
        role: "assistant",
        content: full,
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

    yield { type: "done", message: messageRowToDto(assistantRow) };
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
