import { useEffect, useState } from "react";
import type { OptimisticUserMessage } from "./types.ts";

interface OptimisticDeps {
  chatId: string | undefined;
  messagesLength: number;
}

export function useOptimisticMessage(deps: OptimisticDeps) {
  const { chatId, messagesLength } = deps;
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<OptimisticUserMessage | null>(
    null,
  );

  const isForVisibleChat =
    optimisticUserMessage !== null &&
    (chatId === undefined || optimisticUserMessage.chatId === chatId);
  const persisted =
    optimisticUserMessage !== null &&
    chatId === optimisticUserMessage.chatId &&
    messagesLength > optimisticUserMessage.messageCountBeforeSend;
  const shouldShowOptimisticUserMessage = isForVisibleChat && !persisted;

  useEffect(() => {
    if (persisted) {
      setOptimisticUserMessage(null);
    }
  }, [persisted]);

  return {
    optimisticUserMessage,
    setOptimisticUserMessage,
    shouldShowOptimisticUserMessage,
  };
}

export type OptimisticMessage = ReturnType<typeof useOptimisticMessage>;
