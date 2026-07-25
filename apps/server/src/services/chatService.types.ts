import type { InferSelectModel } from "drizzle-orm";
import type { chats, messages } from "../db/schema.ts";

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
  | { type: "map"; cmuMaps: CmuMapsDto }
  | { type: "delta"; text: string }
  | { type: "done"; message: MessageDto }
  | { type: "error"; message: string };

export type MessageRow = InferSelectModel<typeof messages>;
export type ChatRow = InferSelectModel<typeof chats>;
