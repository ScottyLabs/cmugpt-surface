import { useMemo } from "react";
import type { AuthUser } from "@/integrations/auth/AuthProvider.tsx";
import type { StreamController } from "./useStreamController.ts";
import type { OptimisticMessage } from "./useOptimisticMessage.ts";
import type { ChatSession } from "./useChatSession.ts";
import type { ChatDetail, CmuMapsPayload } from "./types.ts";

interface DerivedDeps {
  session: ChatSession;
  stream: StreamController;
  optimistic: OptimisticMessage;
  profile: AuthUser | null;
}

function useLastAssistantCmuMaps(messages: ChatSession["messages"]): CmuMapsPayload | null {
  return useMemo<CmuMapsPayload | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (
        m.role === "assistant" &&
        m.cmuMaps !== null &&
        m.cmuMaps !== undefined &&
        m.cmuMaps.url !== null &&
        m.cmuMaps.url !== ""
      ) {
        return m.cmuMaps;
      }
    }
    return null;
  }, [messages]);
}

export function useChatDerived(deps: DerivedDeps) {
  const { session, stream, optimistic, profile } = deps;
  const { chatId, chats, messages, chatDetail, messagesLoading } = session;
  const currentChat = chats.find((c) => c.id === chatId);
  const shouldShowConversation =
    Boolean(chatId) || optimistic.shouldShowOptimisticUserMessage || stream.isStreaming;
  const showMessagesLoading =
    Boolean(chatId) && messagesLoading && !optimistic.shouldShowOptimisticUserMessage;
  const effectiveChatDetail = useMemo<ChatDetail | undefined>(() => {
    if (chatDetail !== undefined) {
      return chatDetail;
    }
    return currentChat !== undefined && chatId !== undefined && currentChat.id === chatId
      ? { ...currentChat, isOwner: true }
      : undefined;
  }, [chatDetail, currentChat, chatId]);
  const canEditChat = effectiveChatDetail?.isOwner === true;
  const showMakePrivate = effectiveChatDetail?.isOwner === true && effectiveChatDetail.isPublic;
  const lastAssistantCmuMaps = useLastAssistantCmuMaps(messages);
  const activeCmuMaps: CmuMapsPayload | null = stream.streamingCmuMaps ?? lastAssistantCmuMaps;
  const displayName = profile?.givenName ?? profile?.email ?? profile?.sub ?? "User";
  const starred = chats.filter((c) => c.starred);
  const unstarred = chats.filter((c) => !c.starred);
  return {
    currentChat,
    shouldShowConversation,
    showMessagesLoading,
    effectiveChatDetail,
    canEditChat,
    showMakePrivate,
    activeCmuMaps,
    displayName,
    starred,
    unstarred,
  };
}

export type ChatDerived = ReturnType<typeof useChatDerived>;
