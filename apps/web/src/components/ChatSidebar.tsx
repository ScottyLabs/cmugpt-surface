import { Brain } from "lucide-react";
import type {
  Dispatch,
  KeyboardEvent,
  ReactNode,
  RefObject,
  SetStateAction,
} from "react";
import { useRef } from "react";
import {
  AboutIcon,
  LogOutIcon,
  PinIcon,
  PlusIcon,
  ScottyLabsIcon,
  SearchIcon,
  SettingsIcon,
  SidebarPanelIcon,
  UnpinIcon,
} from "@/components/icons/ChatIcons.tsx";

const USER_MENU_ITEM_CLASS =
  "flex h-10 w-full items-center gap-3 rounded-lg px-4 text-[0.9375rem] font-normal leading-5 text-neutral-900 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500";

function UserMenuIcon({ children }: { children: ReactNode }) {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center"
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

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
  starred: ChatListItem[];
  unstarred: ChatListItem[];
  toggleStarChat: (id: string, next: boolean) => void;
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
  userMenuTriggerRef: RefObject<HTMLButtonElement | null>;
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
  onOpenMemories: () => void;
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
  starred,
  unstarred,
  toggleStarChat,
  renamingChatId,
  renameDraft,
  setRenameDraft,
  renameInputRef,
  commitRename,
  onRenameKeyDown,
  setSidebarMenu,
  userMenuOpen,
  setUserMenuOpen,
  userMenuTriggerRef,
  user,
  displayName,
  signOut,
  setActiveModal,
  selectChat,
  beginRename,
  onOpenMemories,
}: ChatSidebarProps) {
  const userMenuRef = useRef<HTMLDivElement>(null);

  function handleUserMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % items.length;
    } else if (event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    } else if (event.key === "Escape") {
      event.preventDefault();
      setUserMenuOpen(false);
      userMenuTriggerRef.current?.focus();
      return;
    }
    if (nextIndex !== null) {
      event.preventDefault();
      items[nextIndex]?.focus();
    }
  }

  function renderChatRow(c: ChatListItem) {
    const rowClass = `group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white ${
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
          <>
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleStarChat(c.id, !c.starred);
              }}
              className={`shrink-0 rounded p-0.5 transition-opacity hover:bg-neutral-200/60 ${
                c.starred ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
              aria-label={c.starred ? "Unpin chat" : "Pin chat"}
              title={c.starred ? "Unpin chat" : "Pin chat"}
            >
              {c.starred ? (
                <UnpinIcon className="h-3.5 w-3.5" />
              ) : (
                <PinIcon className="h-3.5 w-3.5" />
              )}
            </button>
          </>
        )}
      </li>
    );
  }

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-transparent rounded-tr-[25px] bg-brand-secondary-enabled transition-[width] duration-200 ease-out ${
        sidebarOpen ? "w-64" : "w-[4.375rem] border-r-0"
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

        {/* Chat Lists — Pinned + Recents */}
        {Boolean(sidebarOpen) && (
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 mt-6">
            {starred.length > 0 && (
              <div className="mb-4">
                <p className="px-2 pb-1 font-medium text-fg-neutral-tertiary text-base">
                  Pinned
                </p>
                <ul className="space-y-0.5">
                  {starred.map((c) => renderChatRow(c))}
                </ul>
              </div>
            )}
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
          <div
            ref={userMenuRef}
            id="user-profile-menu"
            role="menu"
            aria-label="User menu"
            onKeyDown={handleUserMenuKeyDown}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setUserMenuOpen(false);
              }
            }}
            className={`absolute bottom-full mb-2 flex w-[14.5625rem] flex-col items-start rounded-xl border border-blue-gray-50 bg-white px-2 py-2 shadow-[0_0_5.7px_0_rgba(158,177,194,0.29)] ${sidebarOpen ? "left-1/2 -translate-x-1/2" : "left-3"}`}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onOpenMemories();
                setUserMenuOpen(false);
              }}
              className={USER_MENU_ITEM_CLASS}
            >
              <UserMenuIcon>
                <Brain className="h-[1.125rem] w-[1.125rem]" />
              </UserMenuIcon>
              Memories
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setActiveModal("settings");
                setUserMenuOpen(false);
              }}
              className={USER_MENU_ITEM_CLASS}
            >
              <UserMenuIcon>
                <SettingsIcon />
              </UserMenuIcon>
              Settings
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setActiveModal("about");
                setUserMenuOpen(false);
              }}
              className={USER_MENU_ITEM_CLASS}
            >
              <UserMenuIcon>
                <AboutIcon />
              </UserMenuIcon>
              About
            </button>
            <a
              href="https://scottylabs.org/"
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className={USER_MENU_ITEM_CLASS}
            >
              <UserMenuIcon>
                <ScottyLabsIcon />
              </UserMenuIcon>
              ScottyLabs
            </a>
            <hr className="self-center w-[90%] my-3 border-b border-fg-disabled-brandneutral" />
            <button
              type="button"
              role="menuitem"
              onClick={() => void signOut()}
              className={`${USER_MENU_ITEM_CLASS} text-neutral-700`}
            >
              <UserMenuIcon>
                <LogOutIcon />
              </UserMenuIcon>
              Log out
            </button>
          </div>
        )}

        <button
          ref={userMenuTriggerRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const opening = !userMenuOpen;
            setUserMenuOpen(opening);
            if (opening) {
              requestAnimationFrame(() => {
                userMenuRef.current
                  ?.querySelector<HTMLElement>('[role="menuitem"]')
                  ?.focus();
              });
            }
          }}
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
          aria-controls="user-profile-menu"
          className={`flex w-full items-center rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 ${sidebarOpen ? "gap-3" : "justify-center"}`}
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
