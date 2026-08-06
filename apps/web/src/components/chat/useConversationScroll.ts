import type { UIEvent } from "react";
import { useEffect, useRef } from "react";
import { STICKY_SCROLL_THRESHOLD_PX } from "./constants.ts";

interface ScrollDeps {
  isStreaming: boolean;
  messagesLength: number;
  streamingTextLength: number;
}

export function useConversationScroll(deps: ScrollDeps) {
  const { isStreaming, messagesLength, streamingTextLength } = deps;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    if (!isStreaming && messagesLength === 0 && streamingTextLength === 0) {
      return;
    }
    if (!shouldStickToBottomRef.current) {
      return;
    }
    bottomRef.current?.scrollIntoView({
      behavior: isStreaming ? "auto" : "smooth",
    });
  }, [isStreaming, messagesLength, streamingTextLength]);

  function onScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    shouldStickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight <= STICKY_SCROLL_THRESHOLD_PX;
  }

  return { scrollContainerRef, bottomRef, shouldStickToBottomRef, onScroll };
}

export type ConversationScroll = ReturnType<typeof useConversationScroll>;
