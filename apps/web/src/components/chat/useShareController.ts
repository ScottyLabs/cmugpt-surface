import { useEffect, useRef, useState } from "react";
import {
  makeChatPrivate,
  shareChatById,
  type ShareCtx,
  shareCurrentChat,
  type ShareFeedback,
} from "./share.ts";
import type { ChatMutations } from "./useChatMutations.ts";
import type { ChatDetail } from "./types.ts";

interface UseShareOptions {
  patchChat: ChatMutations["patchChat"];
  chatId: string | undefined;
  effectiveChatDetail: ChatDetail | undefined;
}

export function useShareController(options: UseShareOptions) {
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ref = timerRef;
    return () => {
      if (ref.current !== null) {
        clearTimeout(ref.current);
      }
    };
  }, []);

  const ctx: ShareCtx = {
    patchChat: options.patchChat,
    chatId: options.chatId,
    effectiveChatDetail: options.effectiveChatDetail,
    setShareFeedback,
    timerRef,
  };

  return {
    shareFeedback,
    shareChatById: (targetId: string, alreadyPublic: boolean) =>
      shareChatById(ctx, targetId, alreadyPublic),
    shareChat: () => shareCurrentChat(ctx),
    makeChatPrivate: () => {
      makeChatPrivate(ctx);
    },
  };
}

export type ShareController = ReturnType<typeof useShareController>;
