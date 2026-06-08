import type { Dispatch, KeyboardEvent, RefObject, SetStateAction } from "react";
import {
  AboutIcon,
  LogOutIcon,
  PinIcon,
  PlusIcon,
  ScottyLabsIcon,
  SearchIcon,
  SettingsIcon,
  SidebarPanelIcon,
} from "@/components/icons/ChatIcons.tsx";

interface ChatListItem {
  id: string;
  title: string;
  starred: boolean;
  isPublic: boolean;
}

interface ChatSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  searchMode: boolean;
  setSearchMode: Dispatch<SetStateAction<boolean>>;
  setSearchQ: (q: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onNewChat: () => void;
  chatId: string | undefined;
  unstarred: ChatListItem[];
  renamingChatId: string | null;
  renameDraft: string;
  setRenameDraft: (s: string) => void;
  renameInputRef: RefObject<HTMLInputElement | null>;
  commitRename: (id: string, originalTitle: string) => void;
  onRenameKeyDown: (
    e: KeyboardEvent<HTMLInputElement>,
    id: string,
    originalTitle: string,
  ) => void;
  setSidebarMenu: Dispatch<
    SetStateAction<{ x: number; y: number; chatId: string } | null>
  >;
  userMenuOpen: boolean;
  setUserMenuOpen: Dispatch<SetStateAction<boolean>>;
  user:
    | {
        imageUrl?: string;
        primaryEmailAddress?: { emailAddress: string } | null;
      }
    | null
    | undefined;
  displayName: string;
  signOut: () => void;
  setActiveModal: (m: "settings" | "about" | null) => void;
  selectChat: (id: string) => void;
  beginRename: (c: { id: string; title: string }) => void;
}

export function ChatSidebar({
  sidebarOpen,
  setSidebarOpen,
  searchMode,
  setSearchMode,
  setSearchQ,
  searchInputRef,
  onNewChat,
  chatId,
  unstarred,
  renamingChatId,
  renameDraft,
  setRenameDraft,
  renameInputRef,
  commitRename,
  onRenameKeyDown,
  setSidebarMenu,
  userMenuOpen,
  setUserMenuOpen,
  user,
  displayName,
  signOut,
  setActiveModal,
  selectChat,
  beginRename,
}: ChatSidebarProps) {
  function renderChatRow(c: ChatListItem) {
    const rowClass = `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white ${
      c.id === chatId ? "bg-white" : ""
    }`;
    return (
      <li
        key={c.id}
        className={rowClass}
        onContextMenu={(e) => {
          e.preventDefault();
          setSidebarMenu({ x: e.clientX, y: e.clientY, chatId: c.id });
        }}
      >
        {renamingChatId === c.id ? (
          <input
            ref={renameInputRef}
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onBlur={() => commitRename(c.id, c.title)}
            onKeyDown={(e) => onRenameKeyDown(e, c.id, c.title)}
            className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-sm outline-none focus:border-neutral-400"
            aria-label="Chat name"
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            onClick={() => selectChat(c.id)}
            onDoubleClick={(e) => {
              e.preventDefault();
              beginRename(c);
            }}
            title="Double-click to rename"
            className="min-w-0 flex-1 truncate text-left hover:bg-white text-lg font-medium"
          >
            {c.title}
          </button>
        )}
      </li>
    );
  }

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-transparent rounded-tr-[25px] bg-brand-secondary-enabled transition-[width] duration-200 ease-out ${
        sidebarOpen ? "w-64" : "w-[4.375rem] overflow-hidden border-r-0"
      }`}
    >
      {/* Header */}
      <div
        className={`flex h-16 mt-3 items-center px-4 ${sidebarOpen ? "gap-10" : "justify-center"}`}
      >
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-200/80 hover:text-neutral-800"
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <SidebarPanelIcon />
        </button>
        {Boolean(sidebarOpen) && (
          <div className="flex min-w-0 items-center gap-1.5">
            <img
              src="/sl-logo.svg"
              alt=""
              className="h-6 w-6 shrink-0 object-contain"
              width={24}
              height={24}
            />
            <span className="truncate text-lg font-semibold leading-none tracking-tight">
              CMUGPT
            </span>
          </div>
        )}
      </div>

      {Boolean(sidebarOpen) && (
        <div className="mx-6 border-b border-fg-disabled-brandneutral" />
      )}

      {/* Navigation */}
      <nav className="flex min-h-0 flex-1 flex-col gap-1 px-3 pt-2">
        <button
          type="button"
          onClick={onNewChat}
          className={`flex items-center rounded-lg py-2 font-medium ${sidebarOpen ? "gap-3 px-3" : "justify-center"}`}
        >
          <div className="flex items-center justify-center rounded-full bg-white p-[0.56rem]">
            <PlusIcon />
          </div>
          {Boolean(sidebarOpen) && <span>New Chat</span>}
        </button>

        <button
          type="button"
          onClick={() => {
            setSearchMode((prev) => !prev);
            if (searchMode) {
              setSearchQ("");
            } else {
              requestAnimationFrame(() => searchInputRef.current?.focus());
            }
          }}
          className={`flex items-center rounded-lg py-2 font-medium ${searchMode ? "bg-white" : "active:bg-white"} ${sidebarOpen ? "gap-3 px-3" : "justify-center"}`}
        >
          <div className="flex items-center justify-center p-[0.56rem]">
            <SearchIcon className="text-black" />
          </div>
          {Boolean(sidebarOpen) && <span>Search</span>}
        </button>

        <button
          type="button"
          className={`flex items-center rounded-lg py-2 font-medium active:bg-white ${sidebarOpen ? "gap-3 px-3" : "justify-center"}`}
        >
          <div className="flex items-center justify-center p-[0.56rem]">
            <PinIcon />
          </div>
          {Boolean(sidebarOpen) && <span>Pin</span>}
        </button>

        {/* Recent Chats */}
        {Boolean(sidebarOpen) && (
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 mt-6">
            <div>
              <p className="px-2 pb-1 font-medium text-fg-neutral-tertiary text-base">
                Recents
              </p>
              <ul className="space-y-0.5">
                {unstarred.map((c) => renderChatRow(c))}
              </ul>
            </div>
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="mt-auto p-4 relative">
        {Boolean(sidebarOpen) && (
          <div className="mb-3 border-b border-fg-disabled-brandneutral" />
        )}

        {/* User menu popup */}
        {Boolean(userMenuOpen) && (
          <div className="absolute bottom-full mb-2 flex w-[14.5625rem] px-2 flex-col items-start rounded-xl bg-white shadow-[0_0_5.7px_0_rgba(158,177,194,0.29)] py-2 left-1/2 -translate-x-1/2">
            <button
              type="button"
              onClick={() => {
                setActiveModal("settings");
                setUserMenuOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50"
            >
              <SettingsIcon />
              Settings
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveModal("about");
                setUserMenuOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50"
            >
              <AboutIcon />
              About
            </button>
            <a href="https://scottylabs.org/" target="_blank" rel="noopener">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50"
              >
                <ScottyLabsIcon />
                ScottyLabs
              </button>
            </a>
            <div className="self-center w-[90%] my-3 border-b border-fg-disabled-brandneutral" />
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <LogOutIcon />
              Log out
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setUserMenuOpen((o) => !o);
          }}
          className={`flex w-full items-center px-2 ${sidebarOpen ? "gap-3" : "justify-center"}`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-300">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{displayName.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          {Boolean(sidebarOpen) && (
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate font-medium">{displayName}</p>
              <p className="text-sm text-fg-neutral-tertiary hover:text-neutral-800">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
