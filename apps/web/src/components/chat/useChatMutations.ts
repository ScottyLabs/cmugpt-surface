import { $api } from "@/lib/api/client.ts";
import type { ChatSession } from "./useChatSession.ts";

export function useChatMutations(session: ChatSession) {
  const { refetchChats, refetchChatDetail, navigate, chatIdRef } = session;

  const createChat = $api.useMutation("post", "/chats", {
    onSuccess: () => {
      void refetchChats();
    },
  });

  const patchChat = $api.useMutation("patch", "/chats/{id}", {
    onSuccess: () => {
      void refetchChats();
      void refetchChatDetail();
    },
  });

  const deleteChat = $api.useMutation("delete", "/chats/{id}", {
    onSuccess: async (_data, variables) => {
      const deletedId = variables.params.path.id;
      const wasActive = chatIdRef.current === deletedId;
      const { data: nextChats } = await refetchChats();
      if (!wasActive) {
        return;
      }
      const list = nextChats ?? [];
      void navigate({
        to: "/",
        search: { chat: list.length > 0 ? list[0].id : undefined, newChat: false },
      });
    },
  });

  return { createChat, patchChat, deleteChat };
}

export type ChatMutations = ReturnType<typeof useChatMutations>;
