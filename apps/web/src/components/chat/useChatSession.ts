import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { $api } from "@/lib/api/client.ts";
import { NO_CHAT } from "./constants.ts";
import { useLatestRef } from "../../lib/useLatestRef.ts";

const routeApi = getRouteApi("/");

function useChatQueries(chatId: string | undefined) {
  const {
    data: chats = [],
    refetch: refetchChats,
    isLoading: chatsLoading,
  } = $api.useQuery("get", "/chats");
  const {
    data: messages = [],
    refetch: refetchMessages,
    isLoading: messagesLoading,
  } = $api.useQuery(
    "get",
    "/chats/{id}/messages",
    { params: { path: { id: chatId ?? NO_CHAT } } },
    { enabled: Boolean(chatId) },
  );
  const { data: chatDetail, refetch: refetchChatDetail } = $api.useQuery(
    "get",
    "/chats/{id}",
    { params: { path: { id: chatId ?? NO_CHAT } } },
    { enabled: Boolean(chatId) },
  );

  return {
    chats,
    refetchChats,
    chatsLoading,
    messages,
    refetchMessages,
    messagesLoading,
    chatDetail,
    refetchChatDetail,
  };
}

export function useChatSession() {
  const navigate = useNavigate();
  const search = routeApi.useSearch();
  const chatId = search.chat;
  const isNewChatIntent = search.newChat;
  const queries = useChatQueries(chatId);

  const chatIdRef = useLatestRef<string | undefined>(chatId);

  return { navigate, chatId, isNewChatIntent, ...queries, chatIdRef };
}

export type ChatSession = ReturnType<typeof useChatSession>;
