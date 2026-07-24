import type { KeyboardEvent } from "react";
import { useCallback, useRef, useState } from "react";
import {
  useRenameFocus,
  useSidebarMenuEscape,
  useSidebarMenuOutsideInteraction,
  useUserMenuOutsideClick,
} from "./chatEffects.ts";
import {
  beginRename,
  commitRename,
  confirmDeleteChatRow,
  onRenameKeyDown,
  type RenamableChat,
  selectChat,
  type SidebarCtx,
  toggleStarChat,
} from "./sidebarActions.ts";
import type { ChatMutations } from "./useChatMutations.ts";
import type { ChatSession } from "./useChatSession.ts";

interface SidebarMenuState {
  x: number;
  y: number;
  chatId: string;
}

interface UseSidebarOptions {
  mutations: ChatMutations;
  navigate: ChatSession["navigate"];
}

function bindSidebarActions(ctx: SidebarCtx) {
  return {
    selectChat: (id: string) => {
      selectChat(ctx, id);
    },
    beginRename: (c: RenamableChat) => {
      beginRename(ctx, c);
    },
    commitRename: (id: string, title: string) => {
      commitRename(ctx, id, title);
    },
    onRenameKeyDown: (
      e: KeyboardEvent<HTMLInputElement>,
      id: string,
      title: string,
    ) => {
      onRenameKeyDown(ctx, e, id, title);
    },
    confirmDeleteChatRow: (id: string) => {
      confirmDeleteChatRow(ctx, id);
    },
    toggleStarChat: (id: string, next: boolean) => {
      toggleStarChat(ctx, id, next);
    },
  };
}

export function useSidebarInteractions(options: UseSidebarOptions) {
  const [sidebarMenu, setSidebarMenu] = useState<SidebarMenuState | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const closeSidebarMenu = useCallback(() => {
    setSidebarMenu(null);
  }, []);

  const ctx: SidebarCtx = {
    patchChat: options.mutations.patchChat,
    deleteChat: options.mutations.deleteChat,
    navigate: options.navigate,
    renameDraft,
    setRenamingChatId,
    setRenameDraft,
    closeSidebarMenu,
  };

  useRenameFocus(renamingChatId, renameInputRef);
  useSidebarMenuEscape(sidebarMenu !== null, closeSidebarMenu);
  useSidebarMenuOutsideInteraction(sidebarMenu !== null, closeSidebarMenu);
  useUserMenuOutsideClick(userMenuOpen, setUserMenuOpen);

  return {
    sidebarMenu,
    setSidebarMenu,
    renamingChatId,
    renameDraft,
    setRenameDraft,
    userMenuOpen,
    setUserMenuOpen,
    renameInputRef,
    closeSidebarMenu,
    ...bindSidebarActions(ctx),
  };
}

export type SidebarInteractions = ReturnType<typeof useSidebarInteractions>;
