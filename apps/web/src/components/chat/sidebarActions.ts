import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ChatMutations } from "./useChatMutations.ts";
import type { ChatSession } from "./useChatSession.ts";

export interface RenamableChat {
  id: string;
  title: string;
}

export interface SidebarCtx {
  patchChat: ChatMutations["patchChat"];
  deleteChat: ChatMutations["deleteChat"];
  navigate: ChatSession["navigate"];
  renameDraft: string;
  setRenamingChatId: (value: string | null) => void;
  setRenameDraft: (value: string) => void;
  closeSidebarMenu: () => void;
}

export function selectChat(ctx: SidebarCtx, id: string): void {
  void ctx.navigate({ to: "/", search: { chat: id, newChat: false } });
}

export function beginRename(ctx: SidebarCtx, c: RenamableChat): void {
  ctx.setRenamingChatId(c.id);
  ctx.setRenameDraft(c.title);
  ctx.closeSidebarMenu();
}

function cancelRename(ctx: SidebarCtx): void {
  ctx.setRenamingChatId(null);
}

export function commitRename(ctx: SidebarCtx, id: string, originalTitle: string): void {
  const t = ctx.renameDraft.trim();
  if (t === "" || t === originalTitle) {
    cancelRename(ctx);
    return;
  }
  ctx.patchChat.mutate(
    { params: { path: { id } }, body: { title: t } },
    {
      onSettled: () => {
        cancelRename(ctx);
      },
    },
  );
}

export function onRenameKeyDown(
  ctx: SidebarCtx,
  e: ReactKeyboardEvent<HTMLInputElement>,
  id: string,
  originalTitle: string,
): void {
  if (e.key === "Enter") {
    e.preventDefault();
    commitRename(ctx, id, originalTitle);
  } else if (e.key === "Escape") {
    e.preventDefault();
    cancelRename(ctx);
  }
}

export function confirmDeleteChatRow(ctx: SidebarCtx, id: string): void {
  ctx.closeSidebarMenu();
  if (!globalThis.confirm("Delete this chat? This cannot be undone.")) {
    return;
  }
  ctx.deleteChat.mutate({ params: { path: { id } } });
}

export function toggleStarChat(ctx: SidebarCtx, id: string, next: boolean): void {
  ctx.patchChat.mutate({ params: { path: { id } }, body: { starred: next } });
}
