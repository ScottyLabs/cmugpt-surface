import { UnpinIcon } from "@/components/icons/UnpinIcon.tsx";
import { PinIcon } from "@/components/icons/index.tsx";
import type { ChatListItem } from "../types.ts";
import type { ChatShellController } from "../useChatShell.ts";

function ChatRowLabel(
  { c, chat }: { c: ChatShellController; chat: ChatListItem },
) {
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
        e.stopPropagation();
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
  const { sidebar, session, search } = c;
  // While search is open the main pane shows results, not the chat, so the
  // active-chat highlight would be misleading; search owns the highlight then.
  const isActive = chat.id === session.chatId && !search.searchMode;
  const rowClass =
    `group flex w-full items-center gap-1 rounded-md px-2 py-2 text-sm hover:bg-neutral-200/80 ${
      isActive ? "bg-neutral-200" : ""
    }`;
  // The pin sits in its own flex track (not overlaid on the label), so it never
  // intercepts a click meant to open the chat. When hidden it keeps its width
  // (no layout shift) but is non-interactive, and it appears without a fade so
  // sweeping across rows doesn't flash.
  return (
    <li className={rowClass}>
      <ChatRowLabel c={c} chat={chat} />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          sidebar.toggleStarChat(chat.id, !starFilled);
        }}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-neutral-300/60 ${
          starFilled
            ? "opacity-100"
            : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
        }`}
        aria-label={starFilled ? "Unpin chat" : "Pin chat"}
        title={starFilled ? "Unpin chat" : "Pin chat"}
      >
        {starFilled
          ? <UnpinIcon className="h-3.5 w-3.5" />
          : <PinIcon className="h-3.5 w-3.5" />}
      </button>
    </li>
  );
}
