import { useState } from "react";
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

  // Once the server has the message, drop the optimistic copy so it cannot resurface on a new chat. Adjusting state during render avoids an extra effect pass.
  if (persisted) {
    setOptimisticUserMessage(null);
  }

  return {
    optimisticUserMessage,
    setOptimisticUserMessage,
    shouldShowOptimisticUserMessage,
  };
}

export type OptimisticMessage = ReturnType<typeof useOptimisticMessage>;
