import { PlusIcon, SearchIcon, SidebarPanelIcon } from "@/components/icons/index.tsx";
import type { ChatShellController } from "../useChatShell.ts";
import { SidebarChatRow } from "./SidebarChatRow.tsx";
import { SidebarFooter } from "./SidebarFooter.tsx";

function SidebarHeader({ c }: { c: ChatShellController }) {
  const { sidebarOpen, setSidebarOpen } = c;
  return (
    <div className={`flex h-16 items-center px-4 ${sidebarOpen ? "gap-10" : "justify-center"}`}>
      <button
        type="button"
        onClick={() => {
          setSidebarOpen((o) => !o);
        }}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-200/80 hover:text-neutral-800"
        aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        <SidebarPanelIcon />
      </button>
      {sidebarOpen && (
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
      )}
    </div>
  );
}

function SidebarNav({ c }: { c: ChatShellController }) {
  const { sidebarOpen, session, derived, search } = c;
  return (
    <nav className="flex flex-col gap-1 px-3 pt-2">
      <button
        type="button"
        onClick={() =>
          void session.navigate({ to: "/", search: { chat: undefined, newChat: true } })
        }
        className={`flex items-center rounded-lg py-2 font-medium ${sidebarOpen ? "gap-3 px-3" : "justify-center"}`}
      >
        <div className="flex items-center justify-center rounded-full bg-white p-[0.56rem]">
          <PlusIcon />
        </div>
        {sidebarOpen && <span>New Chat</span>}
      </button>
      <button
        type="button"
        onClick={() => {
          search.toggleSearch();
        }}
        className={`flex items-center rounded-lg py-2 font-medium ${search.searchMode ? "bg-white" : "active:bg-white"} ${sidebarOpen ? "gap-3 px-3" : "justify-center"}`}
      >
        <div className="flex items-center justify-center p-[0.56rem]">
          <SearchIcon />
        </div>
        {sidebarOpen && <span>Search</span>}
      </button>
      {sidebarOpen && (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 mt-6">
          {derived.starred.length > 0 && (
            <div className="mb-4">
              <p className="px-2 pb-1 font-medium text-fg-neutral-tertiary">Pinned</p>
              <ul className="space-y-0.5">
                {derived.starred.map((chat) => (
                  <SidebarChatRow key={chat.id} c={c} chat={chat} starFilled={true} />
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="px-2 pb-1 font-medium text-fg-neutral-tertiary">Recents</p>
            <ul className="space-y-0.5">
              {derived.unstarred.map((chat) => (
                <SidebarChatRow key={chat.id} c={c} chat={chat} starFilled={false} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </nav>
  );
}

export function ChatSidebar({ c }: { c: ChatShellController }) {
  const { sidebarOpen } = c;
  return (
    <aside
      className={`flex shrink-0 flex-col border-transparent rounded-tr-[25px] bg-brand-secondary-enabled transition-[width] duration-200 ease-out ${
        sidebarOpen ? "w-64" : "w-[4.375rem] overflow-hidden border-r-0"
      }`}
    >
      <SidebarHeader c={c} />
      {sidebarOpen && <div className="mx-6 border-b border-fg-disabled-brandneutral" />}
      <SidebarNav c={c} />
      <SidebarFooter c={c} />
    </aside>
  );
}
