import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api/base.ts";
import { fetchClient } from "@/lib/api/client.ts";
import { useAuth } from "@/integrations/auth/AuthProvider.tsx";
import type { SavedMemory } from "./types.ts";
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
import { type StreamController, useStreamController } from "./useStreamController.ts";
import { useToolToggles } from "./useToolToggles.ts";

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
  await fetch(
    `${API_BASE_URL}/chats/${chatId}/messages/${messageId}/saved-memory`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(savedMemory),
    },
  );
}

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
  return { auth, session, mutations, stream, attachments, optimistic, derived, scroll };
}

export function useChatShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { auth, session, mutations, stream, attachments, optimistic, derived, scroll } =
    useChatShellCore();
  const [memoryManagerOpen, setMemoryManagerOpen] = useState(false);
  const userMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const { refetchMessages } = session;
  const chatIdRef = useRef(session.chatId);
  chatIdRef.current = session.chatId;
  const messagesRef = useRef(session.messages);
  messagesRef.current = session.messages;
  // Explicit remembers are persisted on the assistant message server-side, so
  // that chip arrives with the post-turn message refetch. Self-learned facts
  // are stored a few seconds later by background extraction, past the stream,
  // so after each turn a short retry schedule looks for a learned fact newer
  // than the turn's start, attaches it to that turn's message, and refetches.
  // Both chips then live on the message row and survive reloads.
  const wasStreamingRef = useRef(false);
  const turnStartedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (stream.isStreaming && !wasStreamingRef.current) {
      turnStartedAtRef.current = Date.now();
    }
    const streamJustEnded = !stream.isStreaming && wasStreamingRef.current;
    wasStreamingRef.current = stream.isStreaming;
    if (!streamJustEnded || turnStartedAtRef.current === null) {
      return;
    }
    // The persisted answer is already in the list (its refetch runs before
    // streaming flips off), so this turn's learned fact attaches to it.
    const anchor = messagesRef.current.findLast((m) => m.role !== "user");
    if (anchor === undefined) {
      return;
    }
    const since = turnStartedAtRef.current;
    const chatAtTurn = chatIdRef.current;
    const anchorId = anchor.id;
    if (chatAtTurn === undefined) {
      return;
    }
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
          const fresh = data?.items.find(
            (item) => new Date(item.createdAt).getTime() >= since,
          );
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
      }, delay)
    );
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [stream.isStreaming, refetchMessages]);
  const memory = {
    managerOpen: memoryManagerOpen,
    openManager: useCallback(() => {
      setMemoryManagerOpen(true);
    }, []),
    closeManager: useCallback(() => {
      setMemoryManagerOpen(false);
    }, []),
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
      [refetchMessages],
    ),
  };
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
    memory,
  };
}

export type ChatShellController = ReturnType<typeof useChatShell>;
