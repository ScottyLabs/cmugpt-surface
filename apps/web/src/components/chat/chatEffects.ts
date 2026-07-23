import type { RefObject } from "react";
import { useEffect } from "react";
import type { ChatSession } from "./useChatSession.ts";

interface AutoFocusDeps {
  chatId: string | undefined;
  chatsLoading: boolean;
  chatsLength: number;
  isStreaming: boolean;
  canEditChat: boolean;
  isNewChatIntent: boolean;
}

export function useComposerAutoFocus(
  deps: AutoFocusDeps,
  draftComposerRef: RefObject<HTMLTextAreaElement | null>,
  hasAutoFocusedComposerRef: RefObject<boolean>,
) {
  const { chatId, chatsLoading, chatsLength, isStreaming, canEditChat, isNewChatIntent } = deps;

  useEffect(() => {
    if (
      hasAutoFocusedComposerRef.current ||
      isStreaming ||
      (chatId !== undefined && !canEditChat) ||
      (chatId === undefined && chatsLoading) ||
      (chatId === undefined && chatsLength > 0 && !isNewChatIntent)
    ) {
      return () => {};
    }
    const id = requestAnimationFrame(() => {
      draftComposerRef.current?.focus();
      hasAutoFocusedComposerRef.current = true;
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, [
    chatId,
    chatsLoading,
    chatsLength,
    isStreaming,
    canEditChat,
    isNewChatIntent,
    draftComposerRef,
    hasAutoFocusedComposerRef,
  ]);

  useEffect(() => {
    if (!isNewChatIntent) {
      return () => {};
    }
    const id = requestAnimationFrame(() => {
      draftComposerRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, [isNewChatIntent, draftComposerRef]);
}

interface AutoSelectDeps {
  isNewChatIntent: boolean;
  chatsLoading: boolean;
  chats: ChatSession["chats"];
  chatId: string | undefined;
  navigate: ChatSession["navigate"];
}

export function useAutoSelectFirstChat(deps: AutoSelectDeps) {
  const { isNewChatIntent, chatsLoading, chats, chatId, navigate } = deps;
  useEffect(() => {
    if (isNewChatIntent) {
      return;
    }
    if (!chatsLoading && chats.length > 0 && chatId === undefined) {
      void navigate({
        to: "/",
        search: { chat: chats[0].id, newChat: false },
        replace: true,
      });
    }
  }, [chats, chatId, chatsLoading, navigate, isNewChatIntent]);
}

export function useRenameFocus(
  renamingChatId: string | null,
  renameInputRef: RefObject<HTMLInputElement | null>,
) {
  useEffect(() => {
    if (renamingChatId === null) {
      return () => {};
    }
    const raf = requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [renamingChatId, renameInputRef]);
}

export function useSidebarMenuEscape(open: boolean, closeSidebarMenu: () => void) {
  useEffect(() => {
    if (!open) {
      return () => {};
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        closeSidebarMenu();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeSidebarMenu]);
}

export function useUserMenuOutsideClick(open: boolean, setOpen: (v: boolean) => void) {
  useEffect(() => {
    if (!open) {
      return () => {};
    }
    const handleClick = () => {
      setOpen(false);
    };
    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("click", handleClick);
    };
  }, [open, setOpen]);
}
