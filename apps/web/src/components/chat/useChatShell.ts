import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/integrations/auth/AuthProvider.tsx";
import { useIsMobile } from "@/lib/useIsMobile.ts";
import { useAutoSelectFirstChat, useComposerAutoFocus } from "./chatEffects.ts";
import { useAttachments } from "./useAttachments.ts";
import { type ChatDerived, useChatDerived } from "./useChatDerived.ts";
import { useChatMutations } from "./useChatMutations.ts";
import { type ChatSession, useChatSession } from "./useChatSession.ts";
import { type Composer, useComposer } from "./useComposer.ts";
import { useConversationScroll } from "./useConversationScroll.ts";
import { useModalState } from "./useModalState.ts";
import { useChatSearch } from "./useChatSearch.ts";
import { useOptimisticMessage } from "./useOptimisticMessage.ts";
import { useShareController } from "./useShareController.ts";
import { useSidebarInteractions } from "./useSidebarInteractions.ts";
import {
  type StreamController,
  useStreamController,
} from "./useStreamController.ts";
import { useToolToggles } from "./useToolToggles.ts";

function useChatShellEffects(
  session: ChatSession,
  stream: StreamController,
  derived: ChatDerived,
  composer: Composer,
): void {
  useComposerAutoFocus(
    {
      chatId: session.chatId,
      chatsLoading: session.chatsLoading,
      chatsLength: session.chats.length,
      isStreaming: stream.isStreaming,
      canEditChat: derived.canEditChat,
      isNewChatIntent: session.isNewChatIntent,
    },
    composer.draftComposerRef,
    composer.hasAutoFocusedComposerRef,
  );
  useAutoSelectFirstChat({
    isNewChatIntent: session.isNewChatIntent,
    chatsLoading: session.chatsLoading,
    chats: session.chats,
    chatId: session.chatId,
    navigate: session.navigate,
  });
}

function useChatShellCore() {
  const auth = useAuth();
  const session = useChatSession();
  const mutations = useChatMutations(session);
  const stream = useStreamController();
  const attachments = useAttachments();
  const optimistic = useOptimisticMessage({
    chatId: session.chatId,
    messagesLength: session.messages.length,
  });
  const derived = useChatDerived({
    session,
    stream,
    optimistic,
    profile: auth.user,
  });
  const scroll = useConversationScroll({
    isStreaming: stream.isStreaming,
    messagesLength: session.messages.length,
    streamingTextLength: stream.streamingText.length,
  });
  return {
    auth,
    session,
    mutations,
    stream,
    attachments,
    optimistic,
    derived,
    scroll,
  };
}

export function useChatShell() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile);
  const {
    auth,
    session,
    mutations,
    stream,
    attachments,
    optimistic,
    derived,
    scroll,
  } = useChatShellCore();
  const share = useShareController({
    patchChat: mutations.patchChat,
    chatId: session.chatId,
    effectiveChatDetail: derived.effectiveChatDetail,
  });
  const sidebar = useSidebarInteractions({
    mutations,
    navigate: session.navigate,
  });
  const search = useChatSearch();
  // Opening a chat (from the sidebar or a result) leaves search, so the
  // panel is never a dead end. Selecting a result already closes search;
  // this covers navigating via the sidebar while search is open.
  const { closeSearch } = search;
  const prevChatIdRef = useRef(session.chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== session.chatId) {
      prevChatIdRef.current = session.chatId;
      closeSearch();
    }
  }, [session.chatId, closeSearch]);
  const modal = useModalState();
  const tools = useToolToggles();
  const composer = useComposer({
    session,
    mutations,
    stream,
    attachments,
    scroll,
    canEditChat: derived.canEditChat,
    setOptimisticUserMessage: optimistic.setOptimisticUserMessage,
    disabledToolIds: tools.disabledToolIds,
  });

  useChatShellEffects(session, stream, derived, composer);

  return {
    auth,
    isMobile,
    sidebarOpen,
    setSidebarOpen,
    session,
    mutations,
    stream,
    attachments,
    optimistic,
    derived,
    share,
    sidebar,
    search,
    modal,
    tools,
    scroll,
    composer,
  };
}

export type ChatShellController = ReturnType<typeof useChatShell>;
