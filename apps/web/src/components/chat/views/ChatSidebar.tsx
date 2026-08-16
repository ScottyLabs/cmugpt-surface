import { PlusIcon, SearchIcon, SidebarPanelIcon } from "@/components/icons/index.tsx";
import type { ChatShellController } from "../useChatShell.ts";
import { SidebarChatRow } from "./SidebarChatRow.tsx";
import { SidebarFooter } from "./SidebarFooter.tsx";
import { SidebarOpenButton } from "./SidebarOpenButton.tsx";

function SidebarHeader({ c }: { c: ChatShellController }) {
  const { sidebarOpen } = c;
  if (!sidebarOpen) {
    // Collapsed rail: a single brand button that opens the sidebar, showing the
    // dog logo and morphing to the menu icon on hover. The key differs from the
    // open header so React remounts on toggle instead of reusing (and
    // animating) the same nodes across states.
    return (
      <div key="rail-header" className="flex h-16 items-center justify-center px-4">
        <SidebarOpenButton c={c} />
      </div>
    );
  }
  return <OpenSidebarHeader c={c} />;
}

// Brand on the left; search and collapse controls grouped on the right.
function OpenSidebarHeader({ c }: { c: ChatShellController }) {
  const { setSidebarOpen, search, isMobile } = c;
  return (
    <div key="open-header" className="flex h-16 items-center justify-between gap-2 px-4">
      <div className="flex min-w-0 items-center gap-1.5">
        <img
          src="/sl-logo.svg"
          alt=""
          className="h-6 w-6 shrink-0 object-contain"
          width={24}
          height={24}
        />
        <span className="truncate text-lg font-semibold leading-none tracking-tight">CMUGPT</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => {
            // On mobile the sidebar overlays the screen, so it has to close
            // for the search panel underneath to become visible. Open (not
            // toggle) so tapping search always lands on the search screen.
            if (isMobile) {
              setSidebarOpen(false);
              search.openSearch();
              return;
            }
            search.toggleSearch();
          }}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-200/80 hover:text-neutral-800 ${
            search.searchMode ? "bg-neutral-200 text-neutral-800" : ""
          }`}
          aria-label={search.searchMode ? "Close search" : "Search chats"}
        >
          <SearchIcon />
        </button>
        <button
          type="button"
          onClick={() => {
            setSidebarOpen((o) => !o);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-200/80 hover:text-neutral-800"
          aria-label="Collapse sidebar"
        >
          <SidebarPanelIcon />
        </button>
      </div>
    </div>
  );
}

function SidebarChatLists({ c }: { c: ChatShellController }) {
  const { derived, isMobile, setSidebarOpen, search } = c;
  return (
    <div
      role="presentation"
      className="min-h-0 flex-1 overflow-y-auto px-2 pt-3 pb-2 mt-1 -mb-2 [mask-image:linear-gradient(to_bottom,transparent,black_8px,black_calc(100%-12px),transparent)]"
      onClick={() => {
        if (isMobile) {
          setSidebarOpen(false);
        }
        // Opening any chat exits search, including re-clicking the current
        // chat (which the chatId-change effect can't catch). Pin clicks
        // stopPropagation, so they don't land here.
        if (search.searchMode) {
          search.closeSearch();
        }
      }}
    >
      {derived.starred.length > 0 && (
        <div className="mb-4">
          <p className="px-2 pb-1 font-medium text-fg-neutral-tertiary">Starred</p>
          <ul className="space-y-1">
            {derived.starred.map((chat) => (
              <SidebarChatRow key={chat.id} c={c} chat={chat} starFilled />
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="px-2 pb-1 font-medium text-fg-neutral-tertiary">Recents</p>
        <ul className="space-y-1">
          {derived.unstarred.map((chat) => (
            <SidebarChatRow key={chat.id} c={c} chat={chat} starFilled={false} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function SidebarNav({ c }: { c: ChatShellController }) {
  const { sidebarOpen, session, search, isMobile, setSidebarOpen } = c;
  function startNewChat() {
    if (isMobile) {
      setSidebarOpen(false);
    }
    // Close search explicitly: the chatId-change effect can't, because
    // starting a new chat from the new-chat state leaves chatId undefined.
    search.closeSearch();
    void session.navigate({
      to: "/",
      search: { chat: undefined, newChat: true },
    });
  }
  if (!sidebarOpen) {
    return <RailNav c={c} startNewChat={startNewChat} />;
  }
  // px-2 aligns the New Chat row with the chat list below it (same left inset).
  return (
    <nav key="open-nav" className="flex flex-col gap-1 px-2 pt-2">
      <button
        type="button"
        onClick={startNewChat}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200/80"
      >
        <span className="flex items-center justify-center rounded-full bg-white p-1.5 shadow-sm">
          <PlusIcon />
        </span>
        <span>New Chat</span>
      </button>
    </nav>
  );
}

// Collapsed rail: compact, centered icon buttons whose hover highlight hugs
// the icon rather than spanning the whole rail. Search lives in the header
// when open, so it only needs an entry point here in the rail.
function RailNav({ c, startNewChat }: { c: ChatShellController; startNewChat: () => void }) {
  const { search, isMobile, setSidebarOpen } = c;
  return (
    <nav key="rail-nav" className="flex flex-col items-center gap-4 px-3 pt-6">
      {/* The white circle stays white; the hover highlight lands on the
          square zone behind it, matching the search button below. */}
      <button
        type="button"
        onClick={startNewChat}
        className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-neutral-200/80"
        aria-label="New chat"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
          <PlusIcon />
        </span>
      </button>
      <button
        type="button"
        onClick={() => {
          if (isMobile) {
            setSidebarOpen(false);
          }
          search.toggleSearch();
        }}
        className={`-mt-1 flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-neutral-200/80 ${
          search.searchMode ? "bg-neutral-200" : ""
        }`}
        aria-label="Search chats"
      >
        <SearchIcon className="h-6 w-6" />
      </button>
    </nav>
  );
}

export function ChatSidebar({ c }: { c: ChatShellController }) {
  const { sidebarOpen } = c;
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-transparent rounded-tr-[25px] bg-brand-secondary-enabled shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] md:static md:z-20 md:shadow-none md:transition-[width] ${
        sidebarOpen
          ? "translate-x-0 md:w-72 md:overflow-hidden"
          : "-translate-x-full md:w-[4.375rem] md:translate-x-0 md:border-r-0"
      }`}
    >
      <SidebarHeader c={c} />
      <SidebarNav c={c} />
      {sidebarOpen && <SidebarChatLists c={c} />}
      <SidebarFooter c={c} />
    </aside>
  );
}
