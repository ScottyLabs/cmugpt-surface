import { and, asc, eq, or } from "drizzle-orm";
import { db } from "../db/index.ts";
import { chats, messages } from "../db/schema.ts";
import { callAgent, streamAgent } from "../lib/agentClient.ts";
import { BadRequestError, NotFoundError } from "../middlewares/errorHandler.ts";
import type {
  ChatListItemDto,
  ChatRow,
  ChatStreamEvent,
  CmuMapsDto,
  MessageDto,
  MessageRow,
} from "./chatService.types.ts";

export const DEFAULT_CHAT_TITLE = "New chat";

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

export function messageRowToDto(row: MessageRow): MessageDto {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    cmuMaps: row.cmuMaps ?? null,
  };
}

export function chatRowToListDto(row: ChatRow): ChatListItemDto {
  return {
    id: row.id,
    title: row.title,
    starred: row.starred,
    isPublic: row.isPublic,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getOwnedChat(chatId: string, userSub: string): Promise<ChatRow | undefined> {
  const [row] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userSub, userSub)))
    .limit(1);
  return row;
}

export async function getReadableChat(
  chatId: string,
  userSub: string,
): Promise<ChatRow | undefined> {
  const [row] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), or(eq(chats.userSub, userSub), eq(chats.isPublic, true))))
    .limit(1);
  return row;
}

async function touchChatAfterUserMessage(
  chat: ChatRow,
  chatId: string,
  trimmed: string,
): Promise<void> {
  if (chat.title === DEFAULT_CHAT_TITLE) {
    await db
      .update(chats)
      .set({ title: titleFromFirstMessage(trimmed), updatedAt: new Date() })
      .where(eq(chats.id, chatId));
  } else {
    await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId));
  }
}

async function fetchMessageHistoryExcluding(
  chatId: string,
  excludeId: string | undefined,
): Promise<{ role: string; content: string }[]> {
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt))
    .limit(200);
  return history
    .filter((m) => m.id !== excludeId)
    .map((m) => ({ role: m.role, content: m.content }));
}

/** Persist user message, refresh chat title if needed, return rows for agent context. */
export async function prepareAssistantTurn(
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
  if (chat === undefined) {
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

  await touchChatAfterUserMessage(chat, chatId, trimmed);

  const messageHistory = await fetchMessageHistoryExcluding(chatId, userRow?.id);

  if (userRow === undefined) {
    throw new Error("Failed to persist user message");
  }

  return { userRow, messageHistory };
}

interface StreamCollectResult {
  result: Awaited<ReturnType<typeof callAgent>> | undefined;
  streamedText: string;
  streamedCmuMaps: CmuMapsDto | null;
  errored: boolean;
}

export async function* runAgentStream(
  content: string,
  messageHistory: { role: string; content: string }[],
  userSub: string,
  preferredModel: string,
  signal: AbortSignal | undefined,
): AsyncGenerator<ChatStreamEvent, StreamCollectResult, undefined> {
  let result: Awaited<ReturnType<typeof callAgent>> | undefined;
  let streamedText = "";
  let streamedCmuMaps: CmuMapsDto | null = null;
  try {
    for await (const ev of streamAgent(
      {
        query: content,
        ...(messageHistory.length > 0 && { messageHistory }),
        userId: userSub,
        model: preferredModel,
      },
      signal,
    )) {
      if (ev.type === "status") {
        yield { type: "status", text: ev.text };
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
        return { result, streamedText, streamedCmuMaps, errored: true };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Agent request failed";
    yield { type: "error", message: msg };
    return { result, streamedText, streamedCmuMaps, errored: true };
  }
  return { result, streamedText, streamedCmuMaps, errored: false };
}

export async function* finalizeAssistantMessage(
  chatId: string,
  result: Awaited<ReturnType<typeof callAgent>> | undefined,
  streamedText: string,
  streamedCmuMaps: CmuMapsDto | null,
): AsyncGenerator<ChatStreamEvent, void, undefined> {
  let finalResult = result;
  if (finalResult === undefined) {
    if (!streamedText.trim()) {
      yield {
        type: "error",
        message: "Agent stream ended without a response",
      };
      return;
    }
    finalResult = { text: streamedText };
  } else if (!streamedText) {
    yield { type: "delta", text: finalResult.text };
  }

  let finalCmuMaps = streamedCmuMaps;
  if (finalResult.cmuMaps && finalCmuMaps === null) {
    finalCmuMaps = finalResult.cmuMaps;
    yield { type: "map", cmuMaps: finalResult.cmuMaps };
  }

  const [assistantRow] = await db
    .insert(messages)
    .values({
      chatId,
      role: "assistant",
      content: finalResult.text,
      cmuMaps: finalResult.cmuMaps ?? finalCmuMaps,
    })
    .returning();

  await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId));

  if (assistantRow === undefined) {
    yield { type: "error", message: "Failed to persist assistant message" };
    return;
  }

  const finalMessage: MessageDto = messageRowToDto(assistantRow);
  if (typeof finalResult.confidence === "number") {
    finalMessage.confidence = finalResult.confidence;
  }
  yield { type: "done", message: finalMessage };
}
