import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api/base.ts";
import { fetchClient } from "@/lib/api/client.ts";
import type { MessageItem, SavedMemory } from "./types.ts";

// The agent's background extraction usually lands a few seconds after the
// turn ends, so the lookup retries on a short schedule and stops at the
// first hit rather than waiting once for the worst case.
const LEARNED_NOTICE_CHECK_DELAYS_MS = [2_000, 4_000, 6_500, 9_500, 14_000];

/** Persist (or clear, with null) the saved-memory chip on one message.
 *  Hand-rolled route, so this uses fetch directly with the session cookie. */
async function putSavedMemory(
  chatId: string,
  messageId: string,
  savedMemory: SavedMemory | null,
): Promise<void> {
  await fetch(`${API_BASE_URL}/chats/${chatId}/messages/${messageId}/saved-memory`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(savedMemory),
  });
}

/** Finds the newest non-user message, written as a loop because findLast and
 *  toReversed are newer than the linter's type library. */
function newestAssistantMessage(messages: readonly MessageItem[]): MessageItem | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const candidate = messages[i];
    if (candidate !== undefined && candidate.role !== "user") {
      return candidate;
    }
  }
  return undefined;
}

function scheduleLearnedChecks(
  chatAtTurn: string,
  anchorId: string,
  since: number,
  chatIdRef: React.RefObject<string | undefined>,
  refetchMessages: () => Promise<unknown>,
): () => void {
  let done = false;
  const timers = LEARNED_NOTICE_CHECK_DELAYS_MS.map((delay) =>
    window.setTimeout(() => {
      void (async () => {
        if (done || chatIdRef.current !== chatAtTurn) {
          return;
        }
        const { data } = await fetchClient.GET("/me/memories", {
          params: { query: { kind: "learned", limit: 5, offset: 0 } },
        });
        const fresh = data?.items.find((item) => new Date(item.createdAt).getTime() >= since);
        if (done || fresh === undefined || chatIdRef.current !== chatAtTurn) {
          return;
        }
        done = true;
        await putSavedMemory(chatAtTurn, anchorId, {
          id: fresh.id,
          kind: "learned",
          fact: fresh.text,
        });
        await refetchMessages();
      })();
    }, delay),
  );
  return () => {
    for (const timer of timers) {
      window.clearTimeout(timer);
    }
  };
}

/** Explicit remembers are persisted on the assistant message server-side, so
 *  that chip arrives with the post-turn message refetch. Self-learned facts
 *  are stored a few seconds later by background extraction, past the stream,
 *  so after each turn a short retry schedule looks for a learned fact newer
 *  than the turn's start, attaches it to that turn's message, and refetches.
 *  Both chips then live on the message row and survive reloads. */
export function useLearnedMemoryChip(
  isStreaming: boolean,
  chatIdRef: React.RefObject<string | undefined>,
  messagesRef: React.RefObject<readonly MessageItem[]>,
  refetchMessages: () => Promise<unknown>,
): void {
  const wasStreamingRef = useRef(false);
  const turnStartedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (isStreaming && !wasStreamingRef.current) {
      turnStartedAtRef.current = Date.now();
    }
    const streamJustEnded = !isStreaming && wasStreamingRef.current;
    wasStreamingRef.current = isStreaming;
    if (!streamJustEnded || turnStartedAtRef.current === null) {
      return () => {};
    }
    // The persisted answer is already in the list (its refetch runs before
    // streaming flips off), so this turn's learned fact attaches to it.
    const anchor = newestAssistantMessage(messagesRef.current);
    const chatAtTurn = chatIdRef.current;
    if (anchor === undefined || chatAtTurn === undefined) {
      return () => {};
    }
    return scheduleLearnedChecks(
      chatAtTurn,
      anchor.id,
      turnStartedAtRef.current,
      chatIdRef,
      refetchMessages,
    );
  }, [isStreaming, refetchMessages, chatIdRef, messagesRef]);
}

/** The memory controller handed to views: manager open state, the avatar
 *  button ref that focus returns to, and chip deletion. */
export function useMemoryController(
  chatIdRef: React.RefObject<string | undefined>,
  refetchMessages: () => Promise<unknown>,
) {
  const managerOpenState = useState(false);
  const [managerOpen, setManagerOpen] = managerOpenState;
  const userMenuTriggerRef = useRef<HTMLButtonElement>(null);
  return {
    managerOpen,
    openManager: useCallback(() => {
      setManagerOpen(true);
    }, [setManagerOpen]),
    closeManager: useCallback(() => {
      setManagerOpen(false);
    }, [setManagerOpen]),
    userMenuTriggerRef,
    // The chip's own control deletes the memory itself; here we clear it from
    // its message so it does not reappear on the next load, then refetch.
    onSavedMemoryDeleted: useCallback(
      (messageId: string) => {
        const chatId = chatIdRef.current;
        if (chatId === undefined) {
          return;
        }
        void (async () => {
          await putSavedMemory(chatId, messageId, null);
          await refetchMessages();
        })();
      },
      [refetchMessages, chatIdRef],
    ),
  };
}
