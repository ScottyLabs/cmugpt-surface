import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import type { ChatSession } from "./useChatSession.ts";

interface AutoFocusDeps {
  chatId: string | undefined;
  chatsLoading: boolean;
  chatsLength: number;
  isStreaming: boolean;
  canEditChat: boolean;
  isNewChatIntent: boolean;
}

function useInitialComposerAutoFocus(
  deps: AutoFocusDeps,
  draftComposerRef: RefObject<HTMLTextAreaElement | null>,
  hasAutoFocusedComposerRef: RefObject<boolean>,
) {
  const {
    chatId,
    chatsLoading,
    chatsLength,
    isStreaming,
    canEditChat,
    isNewChatIntent,
  } = deps;

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
}

function useNewChatComposerAutoFocus(
  isNewChatIntent: boolean,
  draftComposerRef: RefObject<HTMLTextAreaElement | null>,
) {
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

export function useComposerAutoFocus(
  deps: AutoFocusDeps,
  draftComposerRef: RefObject<HTMLTextAreaElement | null>,
  hasAutoFocusedComposerRef: RefObject<boolean>,
) {
  useInitialComposerAutoFocus(deps, draftComposerRef, hasAutoFocusedComposerRef);
  useNewChatComposerAutoFocus(deps.isNewChatIntent, draftComposerRef);
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
  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (isNewChatIntent || hasAutoSelectedRef.current) {
      return;
    }
    if (!chatsLoading && chats.length > 0 && chatId === undefined) {
      hasAutoSelectedRef.current = true;
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

export function useSidebarMenuEscape(
  open: boolean,
  closeSidebarMenu: () => void,
) {
  useEffect(() => {
    if (!open) {
      return () => {};
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        closeSidebarMenu();
      }
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeSidebarMenu]);
}

export function useUserMenuOutsideClick(
  open: boolean,
  setOpen: (v: boolean) => void,
) {
  useEffect(() => {
    if (!open) {
      return () => {};
    }
    const handleClick = () => {
      setOpen(false);
    };
    globalThis.addEventListener("click", handleClick);
    return () => {
      globalThis.removeEventListener("click", handleClick);
    };
  }, [open, setOpen]);
}

/**
 * Closes the sidebar row context menu on any outside click/right-click.
 * Deliberately a passive `window` listener rather than a full-screen overlay:
 * an overlay intercepts the click's target, so the click that dismisses the
 * menu never reaches whatever the user actually meant to click (a chat row),
 * forcing a second click. This lets the same click both dismiss the menu and
 * still reach its target, since window listeners fire after the target's own
 * handlers during the bubble phase.
 */
export function useSidebarMenuOutsideInteraction(
  open: boolean,
  closeSidebarMenu: () => void,
) {
  useEffect(() => {
    if (!open) {
      return () => {};
    }
    const handleDismiss = () => {
      closeSidebarMenu();
    };
    globalThis.addEventListener("click", handleDismiss);
    globalThis.addEventListener("contextmenu", handleDismiss);
    return () => {
      globalThis.removeEventListener("click", handleDismiss);
      globalThis.removeEventListener("contextmenu", handleDismiss);
    };
  }, [open, closeSidebarMenu]);
}
