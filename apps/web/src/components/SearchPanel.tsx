import type { RefObject } from "react";
import { SearchIcon } from "@/components/icons/ChatIcons.tsx";

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
      <div className="mt-3 flex h-14 shrink-0 items-center justify-center px-4 sm:px-6">
        <div className="flex w-full max-w-2xl items-center gap-3 rounded-full bg-neutral-100 px-4 py-2.5">
          <SearchIcon />
          <input
            ref={searchInputRef}
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search Chat History"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {searchQ.trim() ? (
          chatsLoading ? (
            <div className="p-6 text-center text-sm text-neutral-500">
              Searching…
            </div>
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-neutral-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden={true}
              >
                <path
                  d="M15.0003 9.16699C15.0003 5.94533 12.3887 3.33366 9.16699 3.33366C5.94533 3.33366 3.33366 5.94533 3.33366 9.16699C3.33366 12.3887 5.94533 15.0003 9.16699 15.0003C12.3887 15.0003 15.0003 12.3887 15.0003 9.16699ZM16.667 9.16699C16.667 10.9378 16.0519 12.5641 15.0256 13.8472L18.0895 16.9111C18.4149 17.2366 18.4149 17.7641 18.0895 18.0895C17.7641 18.4149 17.2366 18.4149 16.9111 18.0895L13.8472 15.0256C12.5641 16.0519 10.9378 16.667 9.16699 16.667C5.02486 16.667 1.66699 13.3091 1.66699 9.16699C1.66699 5.02486 5.02486 1.66699 9.16699 1.66699C13.3091 1.66699 16.667 5.02486 16.667 9.16699Z"
                  fill="#d4d4d4"
                />
              </svg>
              <p className="text-base">No results found</p>
            </div>
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
          <div className="flex flex-col items-center justify-center h-full gap-4 text-neutral-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden={true}
            >
              <path
                d="M15.0003 9.16699C15.0003 5.94533 12.3887 3.33366 9.16699 3.33366C5.94533 3.33366 3.33366 5.94533 3.33366 9.16699C3.33366 12.3887 5.94533 15.0003 9.16699 15.0003C12.3887 15.0003 15.0003 12.3887 15.0003 9.16699ZM16.667 9.16699C16.667 10.9378 16.0519 12.5641 15.0256 13.8472L18.0895 16.9111C18.4149 17.2366 18.4149 17.7641 18.0895 18.0895C17.7641 18.4149 17.2366 18.4149 16.9111 18.0895L13.8472 15.0256C12.5641 16.0519 10.9378 16.667 9.16699 16.667C5.02486 16.667 1.66699 13.3091 1.66699 9.16699C1.66699 5.02486 5.02486 1.66699 9.16699 1.66699C13.3091 1.66699 16.667 5.02486 16.667 9.16699Z"
                fill="#d4d4d4"
              />
            </svg>
            <p className="text-base">Try Searching something!</p>
          </div>
        )}
      </div>
    </div>
  );
}
