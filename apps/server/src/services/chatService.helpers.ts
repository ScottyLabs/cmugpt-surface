import { and, asc, eq, or } from "drizzle-orm";
import { db } from "../db/index.ts";
import { chats, messages } from "../db/schema.ts";
import { fetchChatTitle } from "../lib/agentClient.ts";
import { BadRequestError, NotFoundError } from "../middlewares/errorHandler.ts";
import type {
  ChatListItemDto,
  ChatRow,
  MessageDto,
  MessageRow,
} from "./chatService.types.ts";

export const DEFAULT_CHAT_TITLE = "New chat";

// The agent rejects longer queries with a 400. Fail before persisting the
// user row, or the chat keeps a message that can never get a reply.
const MAX_MESSAGE_CHARS = 8_000;

export function titleFromFirstMessage(content: string): string {
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
    savedMemory: row.savedMemory ?? null,
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

async function touchChatAfterUserMessage(chatId: string): Promise<void> {
  await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId));
}

/** Name an as-yet-unnamed chat from its first message.
 *
 * Runs once per chat, concurrently with the agent turn, so the chat shows
 * "New chat" until the generated title arrives. The truncated message is only
 * a fallback for when generation fails, and a flagged message comes back as
 * the default title, which leaves the chat unnamed for the next message to
 * claim. The WHERE clause matches only the still-default title, so a manual
 * rename that lands first is never clobbered. */
export async function upgradeChatTitle(chatId: string, firstMessage: string): Promise<void> {
  const title = (await fetchChatTitle(firstMessage)) ?? titleFromFirstMessage(firstMessage);
  if (title === DEFAULT_CHAT_TITLE) {
    return;
  }
  await db
    .update(chats)
    .set({ title })
    .where(and(eq(chats.id, chatId), eq(chats.title, DEFAULT_CHAT_TITLE)));
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

/** Persist user message, touch the chat, return rows for agent context.
 * `titledByThisMessage` reports that the chat is still unnamed, which is what
 * arms the one-time title generation for this message. */
export async function prepareAssistantTurn(
  chatId: string,
  userSub: string,
  content: string,
): Promise<{
  userRow: MessageRow;
  messageHistory: { role: string; content: string }[];
  titledByThisMessage: boolean;
}> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new BadRequestError("Message content is required");
  }
  if (trimmed.length > MAX_MESSAGE_CHARS) {
    throw new BadRequestError(
      `Message is too long (max ${MAX_MESSAGE_CHARS.toLocaleString("en-US")} characters)`,
    );
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

  await touchChatAfterUserMessage(chatId);

  const messageHistory = await fetchMessageHistoryExcluding(chatId, userRow?.id);

  if (userRow === undefined) {
    throw new Error("Failed to persist user message");
  }

  return { userRow, messageHistory, titledByThisMessage: chat.title === DEFAULT_CHAT_TITLE };
}

