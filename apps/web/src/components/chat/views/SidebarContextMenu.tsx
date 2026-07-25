import type { ChatListItem } from "../types.ts";
import type { ChatShellController } from "../useChatShell.ts";

interface MenuState {
  x: number;
  y: number;
  chatId: string;
}

function ContextMenuItems({ c, menuChat }: { c: ChatShellController; menuChat: ChatListItem }) {
  const { sidebar, share, mutations } = c;
  return (
    <div
      className="fixed z-50 min-w-[11rem] overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg"
      style={{ left: c.sidebar.sidebarMenu?.x, top: c.sidebar.sidebarMenu?.y }}
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        className="flex w-full px-3 py-2 text-left hover:bg-neutral-100"
        onClick={() => {
          sidebar.beginRename(menuChat);
        }}
      >
        Rename
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex w-full px-3 py-2 text-left hover:bg-neutral-100"
        onClick={() => {
          sidebar.closeSidebarMenu();
          void share.shareChatById(menuChat.id, menuChat.isPublic);
        }}
      >
        Share
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={mutations.deleteChat.isPending}
        className="flex w-full px-3 py-2 text-left text-red-700 hover:bg-red-50 disabled:opacity-50"
        onClick={() => {
          sidebar.confirmDeleteChatRow(menuChat.id);
        }}
      >
        Delete
      </button>
    </div>
  );
}

export function SidebarContextMenu({ c }: { c: ChatShellController }) {
  const { sidebar, session } = c;
  const menu: MenuState | null = sidebar.sidebarMenu;
  const menuChat = menu === null ? undefined : session.chats.find((x) => x.id === menu.chatId);
  if (menu === null || menuChat === undefined) {
    return null;
  }
  return <ContextMenuItems c={c} menuChat={menuChat} />;
}
