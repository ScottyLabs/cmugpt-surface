import type { ChatListItem } from "../types.ts";
import type { ChatShellController } from "../useChatShell.ts";

function ChatRowLabel({ c, chat }: { c: ChatShellController; chat: ChatListItem }) {
  const { sidebar } = c;
  if (sidebar.renamingChatId === chat.id) {
    return (
      <input
        ref={sidebar.renameInputRef}
        value={sidebar.renameDraft}
        onChange={(e) => {
          sidebar.setRenameDraft(e.target.value);
        }}
        onBlur={() => {
          sidebar.commitRename(chat.id, chat.title);
        }}
        onKeyDown={(e) => {
          sidebar.onRenameKeyDown(e, chat.id, chat.title);
        }}
        className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-sm outline-none focus:border-neutral-400"
        aria-label="Chat name"
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        sidebar.selectChat(chat.id);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        sidebar.beginRename(chat);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        sidebar.setSidebarMenu({ x: e.clientX, y: e.clientY, chatId: chat.id });
      }}
      title="Double-click to rename"
      className="min-w-0 flex-1 truncate text-left hover:bg-transparent"
    >
      {chat.title}
    </button>
  );
}

interface SidebarChatRowProps {
  c: ChatShellController;
  chat: ChatListItem;
  starFilled: boolean;
}

export function SidebarChatRow({ c, chat, starFilled }: SidebarChatRowProps) {
  const { sidebar, session } = c;
  const rowClass = `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-200/80 ${
    chat.id === session.chatId ? "bg-neutral-200" : ""
  }`;
  return (
    <li className={rowClass}>
      <button
        type="button"
        onClick={() => {
          sidebar.toggleStarChat(chat.id, !starFilled);
        }}
        className={
          starFilled ? "shrink-0 text-amber-500" : "shrink-0 text-neutral-400 hover:text-amber-500"
        }
        aria-label={starFilled ? "Remove from starred" : "Add to starred"}
      >
        {starFilled ? "★" : "☆"}
      </button>
      <ChatRowLabel c={c} chat={chat} />
    </li>
  );
}
