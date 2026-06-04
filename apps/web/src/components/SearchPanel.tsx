import type { RefObject } from "react";
import {
  CloseIcon,
  FrownIcon,
  SearchIcon,
} from "@/components/icons/ChatIcons.tsx";

interface SearchResult {
  id: string;
  title: string;
  updatedAt?: string;
}

interface SearchPanelProps {
  searchQ: string;
  setSearchQ: (q: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  chats: SearchResult[];
  chatsLoading: boolean;
  onSelectSearchResult: (id: string) => void;
}

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
          <SearchIcon className="text-fg-neutral-primary shrink-0" />
          <input
            ref={searchInputRef}
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search Chat History"
            className="flex-1 bg-transparent text-base font-normal outline-none text-fg-neutral-primary placeholder:text-neutral-500"
          />
          {searchQ && (
            <button
              type="button"
              onClick={() => setSearchQ("")}
              className="shrink-0 text-neutral-400 hover:text-neutral-600"
              aria-label="Clear search"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
            <div className="px-10 pt-8 pb-6">
              <p className="text-fg-neutral-tertiary text-base font-medium mb-6">
                Results for: <span className="text-black">{searchQ}</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                {chats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectSearchResult(c.id)}
                    className="flex flex-col items-start gap-2.5 w-full h-[13.625rem] p-6 text-left rounded-xl border bg-white shadow-[0_2px_6px_0_rgba(0,0,0,0.20)] hover:bg-brand-secondary-hover"
                  >
                    <p className="font-medium text-lg text-black truncate">
                      {c.title}
                    </p>
                    {!!c.updatedAt && (
                      <p className="text-xs text-fg-neutral-tertiary font-normal">
                        {relativeTime(c.updatedAt!)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
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
