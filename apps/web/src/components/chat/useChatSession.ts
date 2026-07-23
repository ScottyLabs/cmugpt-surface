import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { $api } from "@/lib/api/client.ts";
import { NO_CHAT } from "./constants.ts";

const routeApi = getRouteApi("/");

function useChatQueries(chatId: string | undefined) {
  const [searchQ] = useState("");
  const chatsQueryInit = useMemo(() => {
    const q = searchQ.trim();
    return q === "" ? undefined : ({ params: { query: { q } } } as const);
  }, [searchQ]);

  const {
    data: chats = [],
    refetch: refetchChats,
    isLoading: chatsLoading,
  } = $api.useQuery("get", "/chats", chatsQueryInit);
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

  const chatIdRef = useRef<string | undefined>(chatId);
  chatIdRef.current = chatId;

  return { navigate, chatId, isNewChatIntent, ...queries, chatIdRef };
}

export type ChatSession = ReturnType<typeof useChatSession>;
