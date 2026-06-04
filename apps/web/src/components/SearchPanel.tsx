import type { RefObject } from "react";
import { FrownIcon, SearchIcon } from "@/components/icons/ChatIcons.tsx";

interface SearchResult {
  id: string;
  title: string;
}

interface SearchPanelProps {
  searchQ: string;
  setSearchQ: (q: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  chats: SearchResult[];
  chatsLoading: boolean;
  onSelectSearchResult: (id: string) => void;
}

export function SearchPanel({
  searchQ,
  setSearchQ,
  searchInputRef,
  chats,
  chatsLoading,
  onSelectSearchResult,
}: SearchPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="mt-3 flex h-14 shrink-0 items-center justify-start px-4 sm:px-6 mt-6 ml-6">
        <div className="flex w-full max-w-[22.5rem] items-center gap-3 rounded-[6.25rem] bg-neutral-secondary-enabled px-4 py-2.5">
          <SearchIcon className="text-fg-neutral-primary" />
          <input
            ref={searchInputRef}
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search Chat History"
            className="flex-1 bg-transparent text-base font-normal outline-none text-fg-neutral-primary placeholder:text-neutral-500"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {searchQ.trim() ? (
          chatsLoading ? (
            <div className="p-6 text-center text-sm text-fg-neutral-tertiary">
              Searching…
            </div>
          ) : chats.length === 0 ? (
            <>
              <div className="ml-[3.5rem] mt-[2.5rem]">
                <p className="text-fg-neutral-tertiary text-base font-medium">
                  Results for: <span className="text-black">{searchQ}</span>
                </p>
              </div>
              <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-400">
                <FrownIcon />
                <p className="text-fg-neutral-tertiary text-2xl font-medium">
                  Results not found
                </p>
              </div>
            </>
          ) : (
            <ul className="p-4 space-y-1 max-w-2xl mx-auto">
              {chats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSearchResult(c.id)}
                    className="w-full text-left rounded-lg px-4 py-3 text-sm hover:bg-neutral-100 truncate"
                  >
                    {c.title}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-400">
            <SearchIcon className="text-fg-neutral-tertiary w-[2.34375rem] h-[2.34375rem]" />
            <p className="text-xl font-medium text-fg-neutral-tertiary">
              Try Searching something!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
