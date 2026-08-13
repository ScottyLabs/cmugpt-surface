import { FrownIcon } from "@/components/icons/FrownIcon.tsx";
import { CloseIcon, PlusIcon, SearchIcon } from "@/components/icons/index.tsx";
import type { ChatShellController } from "../useChatShell.ts";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function SearchBox({ search }: { search: ChatShellController["search"] }) {
  const { searchQ, setSearchQ, searchInputRef } = search;
  return (
    <div className="mt-6 ml-0 sm:ml-6 flex h-14 shrink-0 items-center justify-start px-4 sm:px-6">
      <div className="flex w-full max-w-[22.5rem] items-center gap-3 rounded-[6.25rem] bg-neutral-secondary-enabled px-4 py-2.5">
        <SearchIcon className="shrink-0 text-fg-neutral-primary" />
        <input
          ref={searchInputRef}
          value={searchQ}
          onChange={(e) => {
            setSearchQ(e.target.value);
          }}
          placeholder="Search Chat History"
          className="flex-1 bg-transparent text-base font-normal text-fg-neutral-primary outline-none placeholder:text-neutral-500"
        />
        {Boolean(searchQ) && (
          <button
            type="button"
            onClick={() => {
              setSearchQ("");
            }}
            className="shrink-0 text-neutral-400 hover:text-neutral-600"
            aria-label="Clear search"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyPrompt() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-400">
      <SearchIcon className="h-[2.34375rem] w-[2.34375rem] text-fg-neutral-tertiary" />
      <p className="text-xl font-medium text-fg-neutral-tertiary">Try Searching something!</p>
    </div>
  );
}

function NoResultsState({ searchQ }: { searchQ: string }) {
  return (
    <>
      <div className="ml-4 mt-10 sm:ml-14">
        <p className="text-base font-medium text-fg-neutral-tertiary">
          Results for: <span className="text-black">{searchQ}</span>
        </p>
      </div>
      <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-400">
        <FrownIcon />
        <p className="text-2xl font-medium text-fg-neutral-tertiary">Results not found</p>
      </div>
    </>
  );
}

interface ResultsGridProps {
  searchQ: string;
  searchChats: ChatShellController["search"]["searchChats"];
  onSelectSearchResult: (id: string) => void;
  onNewChat: () => void;
}

function ResultsGrid({ searchQ, searchChats, onSelectSearchResult, onNewChat }: ResultsGridProps) {
  return (
    <div className="px-4 sm:px-10 pb-6 pt-8">
      <p className="mb-6 text-base font-medium text-fg-neutral-tertiary">
        Results for: <span className="text-black">{searchQ}</span>
      </p>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {searchChats.map((chat) => (
          <button
            key={chat.id}
            type="button"
            onClick={() => {
              onSelectSearchResult(chat.id);
            }}
            className="flex h-[13.625rem] w-full flex-col items-start gap-2.5 rounded-xl bg-white p-6 text-left shadow-[0_2px_6px_0_rgba(0,0,0,0.20)] hover:bg-brand-secondary-hover"
          >
            <p className="w-full break-words text-lg font-medium text-black">{chat.title}</p>
            {chat.updatedAt ? (
              <p className="text-xs font-normal text-fg-neutral-tertiary">
                {relativeTime(chat.updatedAt)}
              </p>
            ) : null}
          </button>
        ))}
        <button
          type="button"
          onClick={onNewChat}
          aria-label="Start a new chat"
          className="flex h-[13.625rem] w-full flex-col items-center justify-center gap-2.5 rounded-xl bg-white p-6 text-left shadow-[0_2px_6px_0_rgba(0,0,0,0.20)] hover:bg-brand-secondary-hover"
        >
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="flex items-center justify-center rounded-full bg-neutral-secondary-enabled p-3">
              <PlusIcon />
            </div>
            <p className="text-lg font-medium text-black">New Chat</p>
          </div>
        </button>
      </div>
    </div>
  );
}

interface SearchResultsProps {
  search: ChatShellController["search"];
  onSelectSearchResult: (id: string) => void;
  onNewChat: () => void;
}

function SearchResults({ search, onSelectSearchResult, onNewChat }: SearchResultsProps) {
  const { searchQ, searchChats, searchChatsLoading } = search;
  if (!searchQ.trim()) {
    return <EmptyPrompt />;
  }
  if (searchChatsLoading) {
    return <div className="p-6 text-center text-sm text-fg-neutral-tertiary">Searching...</div>;
  }
  if (searchChats.length === 0) {
    return <NoResultsState searchQ={searchQ} />;
  }
  return (
    <ResultsGrid
      searchQ={searchQ}
      searchChats={searchChats}
      onSelectSearchResult={onSelectSearchResult}
      onNewChat={onNewChat}
    />
  );
}

export function SearchPanel({ c }: { c: ChatShellController }) {
  const { search, sidebar, session } = c;

  function onSelectSearchResult(id: string) {
    sidebar.selectChat(id);
    search.closeSearch();
  }

  function onNewChat() {
    search.closeSearch();
    void session.navigate({
      to: "/",
      search: { chat: undefined, newChat: true },
    });
  }

  return (
    <div className="flex h-full flex-col">
      <SearchBox search={search} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <SearchResults
          search={search}
          onSelectSearchResult={onSelectSearchResult}
          onNewChat={onNewChat}
        />
      </div>
    </div>
  );
}
