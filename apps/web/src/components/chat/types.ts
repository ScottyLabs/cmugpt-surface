import type { components } from "@cmugpt-frontend/server/build/openapi";

export type CmuMapsPayload = components["schemas"]["CmuMapsDto"];
export type ChatListItem = components["schemas"]["ChatListItemDto"];
export type MessageItem = components["schemas"]["MessageDto"];
export type ChatDetail = components["schemas"]["ChatDetailDto"];

export interface OptimisticUserMessage {
  chatId: string;
  content: string;
  messageCountBeforeSend: number;
}

export type ChatStreamEvent =
  | { type: "user"; message: unknown }
  | { type: "status"; text: string }
  | {
      type: "memory";
      op: "add" | "remove";
      text: string;
      id?: string;
      kind?: "learned" | "remembered";
      fact?: string;
    }
  | { type: "map"; cmuMaps: CmuMapsPayload }
  | { type: "delta"; text: string }
  | { type: "done"; message: unknown }
  | { type: "error"; message: string };

export interface SavedMemoryNotice {
  id: string;
  kind: "learned" | "remembered";
  fact: string;
}
