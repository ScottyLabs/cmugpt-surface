import { useRef, useState } from "react";
import { buildSendCtx, runSend } from "./sendMessage.ts";
import type { Attachments } from "./useAttachments.ts";
import type { ConversationScroll } from "./useConversationScroll.ts";
import type { ChatMutations } from "./useChatMutations.ts";
import type { ChatSession } from "./useChatSession.ts";
import type { StreamController } from "./useStreamController.ts";
import type { OptimisticUserMessage } from "./types.ts";

interface UseComposerDeps {
  session: ChatSession;
  mutations: ChatMutations;
  stream: StreamController;
  attachments: Attachments;
  scroll: ConversationScroll;
  canEditChat: boolean;
  setOptimisticUserMessage: (value: OptimisticUserMessage | null) => void;
}

export function useComposer(deps: UseComposerDeps) {
  const [draft, setDraft] = useState("");
  const draftComposerRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoFocusedComposerRef = useRef(false);

  function clearComposer() {
    setDraft("");
    deps.attachments.setAttachmentHint(null);
    deps.attachments.clearAttachments();
  }

  const ctx = buildSendCtx({
    session: deps.session,
    createChat: deps.mutations.createChat,
    stream: deps.stream,
    attachments: deps.attachments,
    scroll: deps.scroll,
    canEditChat: deps.canEditChat,
    setOptimisticUserMessage: deps.setOptimisticUserMessage,
    draft,
    clearComposer,
  });

  return {
    draft,
    setDraft,
    draftComposerRef,
    hasAutoFocusedComposerRef,
    send: () => runSend(ctx),
  };
}

export type Composer = ReturnType<typeof useComposer>;
