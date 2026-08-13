import type { RefObject } from "react";
import { API_BASE_URL } from "@/lib/api/base.ts";
import { buildOutgoingContent, type PendingAttachment } from "./attachments.ts";
import { STICKY_SCROLL_THRESHOLD_PX } from "./constants.ts";
import type { Attachments } from "./useAttachments.ts";
import type { ConversationScroll } from "./useConversationScroll.ts";
import type { ChatMutations } from "./useChatMutations.ts";
import type { ChatSession } from "./useChatSession.ts";
import type { StreamController } from "./useStreamController.ts";
import type {
  ChatStreamEvent,
  CmuMapsPayload,
  OptimisticUserMessage,
} from "./types.ts";

export interface SendCtx {
  isStreaming: boolean;
  draft: string;
  pendingAttachments: PendingAttachment[];
  /** CMU tools the user switched off; the agent won't be given these. */
  disabledTools: string[];
  chatId: string | undefined;
  canEditChat: boolean;
  messagesLength: number;
  createChat: ChatMutations["createChat"];
  navigate: ChatSession["navigate"];
  refetchMessages: ChatSession["refetchMessages"];
  refetchChats: ChatSession["refetchChats"];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  shouldStickToBottomRef: RefObject<boolean>;
  setStreamError: (value: string | null) => void;
  setStreamStatus: (value: string | null) => void;
  setStreamingCmuMaps: (value: CmuMapsPayload | null) => void;
  setIsStreaming: (value: boolean) => void;
  setOptimisticUserMessage: (value: OptimisticUserMessage | null) => void;
  setAttachmentHint: (value: string | null) => void;
  clearComposer: () => void;
  enqueueStreamingText: (text: string) => void;
  waitForStreamingFlush: () => Promise<void>;
  resetStreamingBuffer: () => void;
}

export interface SendCtxInput {
  session: ChatSession;
  createChat: ChatMutations["createChat"];
  stream: StreamController;
  attachments: Attachments;
  scroll: ConversationScroll;
  canEditChat: boolean;
  setOptimisticUserMessage: (value: OptimisticUserMessage | null) => void;
  draft: string;
  clearComposer: () => void;
  disabledToolIds: string[];
}

export function buildSendCtx(input: SendCtxInput): SendCtx {
  const { session, stream, attachments, scroll } = input;
  return {
    isStreaming: stream.isStreaming,
    draft: input.draft,
    pendingAttachments: attachments.pendingAttachments,
    disabledTools: input.disabledToolIds,
    chatId: session.chatId,
    canEditChat: input.canEditChat,
    messagesLength: session.messages.length,
    createChat: input.createChat,
    navigate: session.navigate,
    refetchMessages: session.refetchMessages,
    refetchChats: session.refetchChats,
    scrollContainerRef: scroll.scrollContainerRef,
    shouldStickToBottomRef: scroll.shouldStickToBottomRef,
    setStreamError: stream.setStreamError,
    setStreamStatus: stream.setStreamStatus,
    setStreamingCmuMaps: stream.setStreamingCmuMaps,
    setIsStreaming: stream.setIsStreaming,
    setOptimisticUserMessage: input.setOptimisticUserMessage,
    setAttachmentHint: attachments.setAttachmentHint,
    clearComposer: input.clearComposer,
    enqueueStreamingText: stream.enqueueStreamingText,
    waitForStreamingFlush: stream.waitForStreamingFlush,
    resetStreamingBuffer: stream.resetStreamingBuffer,
  };
}

function postChatMessageStream(
  chatId: string,
  content: string,
  disabledTools: string[],
): Promise<Response> {
  // Cross-origin in production (web on cmugpt.com, API on api.cmugpt.com);
  // credentials carry the session cookie, and the server bridges it to a Bearer.
  return fetch(`${API_BASE_URL}/chats/${chatId}/messages/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, disabledTools }),
  });
}

async function readStreamErrorDetail(res: Response): Promise<string> {
  try {
    const j: unknown = await res.json();
    if (
      typeof j === "object" &&
      j !== null &&
      "message" in j &&
      typeof j.message === "string" &&
      j.message !== ""
    ) {
      return j.message;
    }
  } catch {
    // ignore malformed error body
  }
  return res.statusText;
}

function isChatStreamEvent(v: unknown): v is ChatStreamEvent {
  return typeof v === "object" && v !== null && "type" in v && typeof v.type === "string";
}

function parseStreamEvent(line: string): ChatStreamEvent | null {
  try {
    const parsed: unknown = JSON.parse(line);
    return isChatStreamEvent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function applyStreamEvent(ev: ChatStreamEvent, ctx: SendCtx): boolean {
  switch (ev.type) {
    case "user":
      void ctx.refetchMessages();
      void ctx.refetchChats();
      return false;
    case "status":
      ctx.setStreamStatus(ev.text);
      return false;
    case "memory":
      // The chip is persisted on the assistant message server-side and
      // appears on the post-`done` message refetch, so nothing is done with
      // this event on the client.
      return false;
    case "map":
      ctx.setStreamingCmuMaps(ev.cmuMaps);
      return false;
    case "delta":
      ctx.setStreamStatus(null);
      ctx.enqueueStreamingText(ev.text);
      return false;
    case "done":
      return true;
    case "error":
      ctx.setStreamError(ev.message);
      void ctx.refetchMessages();
      return false;
    default:
      return false;
  }
}

async function consumeChatStream(res: Response, ctx: SendCtx): Promise<void> {
  if (res.body === null) {
    ctx.setStreamError("No response body");
    return;
  }
  const decoder = new TextDecoder();
  let buf = "";
  let shouldRefresh = false;
  for await (const value of res.body) {
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim() === "") {
        continue;
      }
      const ev = parseStreamEvent(line);
      if (ev !== null && applyStreamEvent(ev, ctx)) {
        shouldRefresh = true;
      }
    }
  }
  await ctx.waitForStreamingFlush();
  if (shouldRefresh) {
    // Load the saved copy of the answer first, so it is on screen ready to
    // replace the live one, then stop streaming. Doing it the other way round
    // would blank the answer out for as long as the request takes.
    await ctx.refetchMessages();
    ctx.setIsStreaming(false);
    ctx.resetStreamingBuffer();
    // This one only updates the chat list in the sidebar. Waiting for it before
    // the swap above would leave the saved answer and the live one on screen
    // together for a full round trip, showing the reply twice.
    void ctx.refetchChats();
  }
}

async function resolveActiveChatId(ctx: SendCtx): Promise<string | null> {
  if (ctx.chatId !== undefined) {
    return ctx.canEditChat ? ctx.chatId : null;
  }
  try {
    const row = await ctx.createChat.mutateAsync({});
    void ctx.navigate({ to: "/", search: { chat: row.id, newChat: false } });
    return row.id;
  } catch {
    ctx.setStreamError("Could not start chat");
    return null;
  }
}

function beginSend(ctx: SendCtx, activeChatId: string, content: string): void {
  ctx.setStreamError(null);
  const scrollEl = ctx.scrollContainerRef.current;
  if (scrollEl !== null) {
    ctx.shouldStickToBottomRef.current =
      scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight <=
      STICKY_SCROLL_THRESHOLD_PX;
  }
  ctx.resetStreamingBuffer();
  // The saved-memory notice is deliberately not cleared here: once anchored
  // to its message it stays visible through later questions. It clears on
  // chat switch, deletion, or a newer fact replacing it.
  ctx.setStreamStatus("Thinking...");
  ctx.setOptimisticUserMessage({
    chatId: activeChatId,
    content,
    messageCountBeforeSend: ctx.messagesLength,
  });
  ctx.setIsStreaming(true);
}

export async function runSend(ctx: SendCtx): Promise<void> {
  if (ctx.isStreaming) {
    return;
  }
  const textPart = ctx.draft.trim();
  if (textPart === "" && ctx.pendingAttachments.length === 0) {
    return;
  }
  const activeChatId = await resolveActiveChatId(ctx);
  if (activeChatId === null) {
    return;
  }
  let content: string;
  try {
    content = await buildOutgoingContent(textPart, ctx.pendingAttachments);
  } catch (e) {
    ctx.setAttachmentHint(e instanceof Error ? e.message : "Could not read attachments.");
    return;
  }
  beginSend(ctx, activeChatId, content);
  try {
    const res = await postChatMessageStream(activeChatId, content, ctx.disabledTools);
    if (!res.ok) {
      ctx.setStreamError((await readStreamErrorDetail(res)) || "Request failed");
      ctx.setOptimisticUserMessage(null);
      void ctx.refetchMessages();
      void ctx.refetchChats();
      return;
    }
    ctx.clearComposer();
    await consumeChatStream(res, ctx);
  } catch {
    ctx.setStreamError("Network error");
    void ctx.refetchMessages();
  } finally {
    ctx.setIsStreaming(false);
    ctx.resetStreamingBuffer();
  }
}
