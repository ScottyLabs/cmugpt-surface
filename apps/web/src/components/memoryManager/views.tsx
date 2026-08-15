import { Brain, LoaderCircle, Search, Trash2, X } from "lucide-react";
import type { MemoryItem, MemoryManagerController } from "./useMemoryManager.ts";
import { FILTERS } from "./useMemoryManager.ts";

export function ManagerHeader({ onClose }: { onClose: () => void }) {
  return (
    <header className="flex items-start justify-between gap-4 px-6 pb-4 pt-6 sm:px-8 sm:pt-8">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <Brain className="h-5 w-5 shrink-0" aria-hidden="true" />
          <h2 id="memory-manager-title" className="text-xl font-medium leading-8 sm:text-2xl">
            Memories
          </h2>
        </div>
        <p
          id="memory-manager-description"
          className="mt-1 text-sm font-normal text-fg-neutral-secondary"
        >
          Facts CMUGPT learned from chats and details you asked it to remember.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg p-1 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
        aria-label="Close memories"
      >
        <X className="h-6 w-6" aria-hidden="true" />
      </button>
    </header>
  );
}

export function ManagerSearch({ mm }: { mm: MemoryManagerController }) {
  return (
    <label className="relative block" htmlFor="memory-search">
      <span className="sr-only">Search memories</span>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-neutral-tertiary"
        aria-hidden="true"
      />
      <input
        ref={mm.refs.searchInputRef}
        id="memory-search"
        type="search"
        value={mm.search}
        onChange={(event) => {
          mm.setSearch(event.target.value);
        }}
        placeholder="Search memories"
        className="h-11 w-full rounded-xl border border-stroke-neutral-1 bg-white pl-10 pr-4 text-base font-normal outline-none transition-shadow placeholder:text-fg-neutral-tertiary focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 sm:text-sm"
      />
    </label>
  );
}

export function ManagerFilterRow({ mm }: { mm: MemoryManagerController }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-b border-fg-disabled-brandneutral pb-3">
      <fieldset className="flex gap-1">
        <legend className="sr-only">Memory type</legend>
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              mm.setFilter(option.value);
            }}
            aria-pressed={mm.filter === option.value}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 ${
              mm.filter === option.value
                ? "bg-brand-secondary-enabled text-fg-neutral-primary"
                : "text-fg-neutral-secondary hover:bg-neutral-100"
            }`}
          >
            {option.label}
          </button>
        ))}
      </fieldset>
      <button
        type="button"
        onClick={(event) => {
          mm.ops.requestClearAll(event.currentTarget);
        }}
        disabled={mm.clearPending || mm.action.deletingKey !== null || mm.total === 0}
        className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {mm.clearPending ? "Clearing..." : "Clear all"}
      </button>
    </div>
  );
}

function ListLoading() {
  return (
    <div className="flex h-40 items-center justify-center gap-2 text-sm text-fg-neutral-secondary">
      <LoaderCircle
        className="h-4 w-4 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      Loading memories...
    </div>
  );
}

function ListError({ mm }: { mm: MemoryManagerController }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-normal text-fg-neutral-secondary">Memories could not be loaded.</p>
      <button
        type="button"
        onClick={() => void mm.memories.refetch()}
        className="rounded-lg bg-brand-secondary-enabled px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
      >
        Try again
      </button>
    </div>
  );
}

function ListEmpty({ mm }: { mm: MemoryManagerController }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center text-center">
      <p className="text-sm font-medium text-fg-neutral-primary">
        {mm.deferredSearch ? "No matching memories" : "No memories yet"}
      </p>
      <p className="mt-1 max-w-sm text-xs font-normal text-fg-neutral-tertiary">
        {mm.deferredSearch
          ? "Try a different word or memory type."
          : "CMUGPT can learn durable details from chats, or you can ask it to remember one."}
      </p>
    </div>
  );
}

function MemoryRow({ item, mm }: { item: MemoryItem; mm: MemoryManagerController }) {
  const key = `${item.type}:${item.id}`;
  const deleting = mm.action.deletingKey === key;
  const typeLabel = item.type === "learned" ? "Learned from chats" : "Asked to remember";
  return (
    <li
      className={`group flex items-start gap-3 rounded-xl px-3 py-3 transition-[opacity,transform,background-color] duration-200 ease-in motion-reduce:transition-none ${
        deleting ? "pointer-events-none translate-x-2 opacity-0" : "hover:bg-neutral-50"
      }`}
    >
      <span
        className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-fg-neutral-tertiary"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-normal leading-6 text-fg-neutral-primary">
          {item.text}
        </p>
        <p className="mt-1 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-neutral-tertiary">
          {typeLabel}
        </p>
      </div>
      <button
        type="button"
        onClick={(event) => {
          mm.ops.requestItemDeletion(item, event.currentTarget);
        }}
        disabled={mm.action.deletingKey !== null}
        className="shrink-0 rounded-lg p-2 text-fg-neutral-tertiary opacity-70 transition-colors hover:bg-red-50 hover:text-red-700 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 group-hover:opacity-100 disabled:cursor-not-allowed"
        aria-label={`Delete ${typeLabel.toLowerCase()} memory`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

function LoadMore({ mm }: { mm: MemoryManagerController }) {
  if (!mm.memories.hasNextPage) return null;
  return (
    <div className="flex justify-center pb-2 pt-4">
      <button
        type="button"
        onClick={() => void mm.memories.fetchNextPage()}
        disabled={mm.memories.isFetchingNextPage}
        className="rounded-lg bg-brand-secondary-enabled px-4 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-wait disabled:opacity-60"
      >
        {mm.memories.isFetchingNextPage ? "Loading..." : "Load more"}
      </button>
    </div>
  );
}

function ListContent({ mm }: { mm: MemoryManagerController }) {
  if (mm.memories.isLoading) return <ListLoading />;
  if (mm.memories.isError) return <ListError mm={mm} />;
  if (mm.items.length === 0) return <ListEmpty mm={mm} />;
  return (
    <ul className="space-y-1" aria-label="Your memories">
      {mm.items.map((item) => (
        <MemoryRow key={`${item.type}:${item.id}`} item={item} mm={mm} />
      ))}
    </ul>
  );
}

export function ManagerList({ mm }: { mm: MemoryManagerController }) {
  return (
    <div className="min-h-[16rem] flex-1 overflow-y-auto py-3 pr-1">
      <ListContent mm={mm} />
      <LoadMore mm={mm} />
    </div>
  );
}

export function ManagerStatus({ mm }: { mm: MemoryManagerController }) {
  const { actionError, actionMessage } = mm.action;
  return (
    <>
      {mm.total > 0 && (
        <p className="text-xs font-normal text-fg-neutral-tertiary">
          Showing {mm.items.length} of {mm.total} memories
        </p>
      )}
      <div aria-live="polite" aria-atomic="true" className="min-h-5">
        {actionError === null ? (
          actionMessage === null ? null : (
            <p className="pt-2 text-xs font-normal text-fg-neutral-secondary">{actionMessage}</p>
          )
        ) : (
          <p className="pt-2 text-xs font-normal text-red-700">{actionError}</p>
        )}
      </div>
    </>
  );
}
