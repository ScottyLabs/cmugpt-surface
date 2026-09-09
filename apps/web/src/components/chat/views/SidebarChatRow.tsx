import type { ChatListItem } from "../types.ts";
import type { ChatShellController } from "../useChatShell.ts";
import { AnimatedTitle } from "./AnimatedTitle.tsx";

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
        className="my-1.5 ml-2 min-w-0 flex-1 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-base outline-none focus:border-neutral-400 sm:text-sm"
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
      className="min-w-0 flex-1 py-2 pl-2 text-left hover:bg-transparent"
    >
      <AnimatedTitle title={chat.title} className="block truncate" />
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
  // The row's padding lives on the label button, not the <li>: padding on the
  // <li> would be a dead zone that swallows clicks (the old "need to click
  // twice" bug), since the label only stretches to its own text otherwise.
  const rowClass = `group flex w-full items-center gap-1 rounded-md pr-1.5 text-sm hover:bg-neutral-200/80 ${
    isActive ? "bg-neutral-200" : ""
  }`;
  // The star sits in its own flex track (not overlaid on the label), so it
  // never intercepts a click meant to open the chat. When hidden it keeps its
  // width (no layout shift) but is non-interactive, and it appears without a
  // fade so sweeping across rows doesn't flash.
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
        aria-label={starFilled ? "Unstar chat" : "Star chat"}
        title={starFilled ? "Unstar chat" : "Star chat"}
      >
        {
          // Same glyphs as the header's star button
        }
        <span aria-hidden className="text-sm leading-none">
          {starFilled ? "★" : "☆"}
        </span>
      </button>
    </li>
  );
}
