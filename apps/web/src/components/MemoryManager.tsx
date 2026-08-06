import { Brain, LoaderCircle, Search, Trash2, X } from "lucide-react";
import type { RefObject } from "react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import type { components } from "@cmugpt-frontend/server/build/openapi";
import { $api } from "@/lib/api/client.ts";
import { useAuth } from "@/integrations/auth/AuthProvider.tsx";
import {
  rememberDeleteConfirmationPreference,
  shouldSkipDeleteConfirmation,
} from "@/lib/memoryPreferences.ts";
import { waitForMotion } from "@/lib/reducedMotion.ts";

type MemoryType = components["schemas"]["AgentMemoryType"];
type MemoryFilter = "all" | MemoryType;

type MemoryItem = components["schemas"]["AgentMemoryItem"];

type PendingAction = { kind: "item"; item: MemoryItem } | { kind: "all" };

interface MemoryManagerProps {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}

const FILTERS: { value: MemoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "learned", label: "Learned" },
  { value: "remembered", label: "Remembered" },
];

const DELETE_TRANSITION_MS = 180;

export function MemoryManager({
  open,
  onClose,
  returnFocusRef,
}: MemoryManagerProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MemoryFilter>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const auth = useAuth();
  const userSub = auth.user?.sub;
  const [skipDeleteConfirmation, setSkipDeleteConfirmation] = useState(() =>
    shouldSkipDeleteConfirmation(userSub),
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const confirmDialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pendingActionRef = useRef<PendingAction | null>(null);
  const deferredSearch = useDeferredValue(search.trim());

  const memories = $api.useInfiniteQuery(
    "get",
    "/me/memories",
    {
      params: {
        query: {
          q: deferredSearch || undefined,
          kind: filter === "all" ? undefined : filter,
          limit: 200,
          offset: 0,
        },
      },
    },
    {
      enabled: open,
      initialPageParam: 0,
      pageParamName: "offset",
      getNextPageParam: (lastPage) => {
        const nextOffset = lastPage.offset + lastPage.items.length;
        return nextOffset < lastPage.total ? nextOffset : undefined;
      },
    },
  );

  const deleteMemory = $api.useMutation("delete", "/me/memories/{kind}/{id}");
  const clearMemories = $api.useMutation("delete", "/me/memories");

  useEffect(() => {
    pendingActionRef.current = pendingAction;
    if (dialogContentRef.current) {
      dialogContentRef.current.inert = pendingAction !== null;
    }
    if (pendingAction === null) return;
    const frame = requestAnimationFrame(() => cancelButtonRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [pendingAction]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    const frame = requestAnimationFrame(() => searchInputRef.current?.focus());
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (pendingActionRef.current !== null) {
          setPendingAction(null);
          setDontShowAgain(false);
          const trigger = actionTriggerRef.current;
          requestAnimationFrame(() => trigger?.focus());
        } else {
          onClose();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusRoot =
        pendingActionRef.current !== null
          ? confirmDialogRef.current
          : dialogRef.current;
      if (!focusRoot) return;
      const focusable = Array.from(
        focusRoot.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      const [first] = focusable;
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      if (
        previouslyFocused instanceof HTMLElement &&
        previouslyFocused.isConnected &&
        previouslyFocused !== document.body
      ) {
        previouslyFocused.focus();
      } else {
        returnFocusRef?.current?.focus();
      }
    };
  }, [open, onClose, returnFocusRef]);

  if (!open) return null;

  const pages = memories.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items) as MemoryItem[];
  const total = pages[0]?.total ?? 0;

  function closeConfirmation() {
    setPendingAction(null);
    setDontShowAgain(false);
    const trigger = actionTriggerRef.current;
    requestAnimationFrame(() => trigger?.focus());
  }

  function requestItemDeletion(item: MemoryItem, trigger: HTMLButtonElement) {
    if (deletingKey !== null) return;
    actionTriggerRef.current = trigger;
    setActionError(null);
    setActionMessage(null);
    if (skipDeleteConfirmation) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
      void removeItem(item);
      return;
    }
    setDontShowAgain(false);
    setPendingAction({ kind: "item", item });
  }

  function requestClearAll(trigger: HTMLButtonElement) {
    actionTriggerRef.current = trigger;
    setActionError(null);
    setActionMessage(null);
    setDontShowAgain(false);
    setPendingAction({ kind: "all" });
  }

  function confirmPendingAction() {
    const action = pendingAction;
    if (action === null) return;
    if (action.kind === "item" && dontShowAgain) {
      rememberDeleteConfirmationPreference(userSub);
      setSkipDeleteConfirmation(true);
    }
    setPendingAction(null);
    setDontShowAgain(false);
    requestAnimationFrame(() => searchInputRef.current?.focus());
    if (action.kind === "item") {
      void removeItem(action.item);
    } else {
      void clearAll();
    }
  }

  async function removeItem(item: MemoryItem) {
    const key = `${item.type}:${item.id}`;
    setActionError(null);
    setActionMessage(null);
    setDeletingKey(key);
    try {
      // Exit animation and DELETE round-trip are independent; overlap them.
      await Promise.all([
        waitForMotion(DELETE_TRANSITION_MS),
        deleteMemory.mutateAsync({
          params: { path: { kind: item.type, id: item.id } },
        }),
      ]);
      await memories.refetch();
      setActionMessage("Memory deleted.");
    } catch {
      setActionError("That memory could not be deleted. Please try again.");
    } finally {
      setDeletingKey(null);
    }
  }

  async function clearAll() {
    setActionError(null);
    setActionMessage(null);
    try {
      await clearMemories.mutateAsync({});
      await memories.refetch();
      setActionMessage("All memories cleared.");
    } catch {
      setActionError("Your memories could not be cleared. Please try again.");
    }
  }

  const confirmationTitle =
    pendingAction?.kind === "all"
      ? "Clear all memories?"
      : "Delete this memory?";
  const confirmationDescription =
    pendingAction?.kind === "all"
      ? "This removes every learned and remembered fact CMUGPT uses to personalize replies."
      : "CMUGPT will stop using this fact to personalize future replies.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close memories"
        className="absolute inset-0 h-full w-full bg-[rgba(245,245,245,0.75)] backdrop-blur-[3.55px]"
        onClick={() => {
          if (pendingAction === null) onClose();
        }}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-manager-title"
        aria-describedby="memory-manager-description"
        className="relative flex max-h-[min(44rem,calc(100dvh-3rem))] w-full max-w-[45.5625rem] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_6px_0_rgba(0,0,0,0.20)]"
      >
        <div ref={dialogContentRef} className="contents">
          <header className="flex items-start justify-between gap-4 px-6 pb-4 pt-6 sm:px-8 sm:pt-8">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <Brain className="h-5 w-5 shrink-0" aria-hidden="true" />
                <h2
                  id="memory-manager-title"
                  className="text-xl font-medium leading-8 sm:text-2xl"
                >
                  Memories
                </h2>
              </div>
              <p
                id="memory-manager-description"
                className="mt-1 text-sm font-normal text-fg-neutral-secondary"
              >
                Facts CMUGPT learned from chats and details you asked it to
                remember.
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

          <div className="flex min-h-0 flex-1 flex-col px-6 pb-6 sm:px-8 sm:pb-8">
            <label className="relative block" htmlFor="memory-search">
              <span className="sr-only">Search memories</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-neutral-tertiary"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                id="memory-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search memories"
                className="h-11 w-full rounded-xl border border-stroke-neutral-1 bg-white pl-10 pr-4 text-sm font-normal outline-none transition-shadow placeholder:text-fg-neutral-tertiary focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
              />
            </label>

            <div className="mt-4 flex items-center justify-between gap-3 border-b border-fg-disabled-brandneutral pb-3">
              <fieldset className="flex gap-1">
                <legend className="sr-only">Memory type</legend>
                {FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    aria-pressed={filter === option.value}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 ${
                      filter === option.value
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
                onClick={(event) => requestClearAll(event.currentTarget)}
                disabled={
                  clearMemories.isPending ||
                  deletingKey !== null ||
                  total === 0
                }
                className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {clearMemories.isPending ? "Clearing..." : "Clear all"}
              </button>
            </div>

            <div className="min-h-[16rem] flex-1 overflow-y-auto py-3 pr-1">
              {memories.isLoading ? (
                <div className="flex h-40 items-center justify-center gap-2 text-sm text-fg-neutral-secondary">
                  <LoaderCircle
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Loading memories...
                </div>
              ) : memories.isError ? (
                <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm font-normal text-fg-neutral-secondary">
                    Memories could not be loaded.
                  </p>
                  <button
                    type="button"
                    onClick={() => void memories.refetch()}
                    className="rounded-lg bg-brand-secondary-enabled px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
                  >
                    Try again
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center text-center">
                  <p className="text-sm font-medium text-fg-neutral-primary">
                    {deferredSearch
                      ? "No matching memories"
                      : "No memories yet"}
                  </p>
                  <p className="mt-1 max-w-sm text-xs font-normal text-fg-neutral-tertiary">
                    {deferredSearch
                      ? "Try a different word or memory type."
                      : "CMUGPT can learn durable details from chats, or you can ask it to remember one."}
                  </p>
                </div>
              ) : (
                <ul className="space-y-1" aria-label="Your memories">
                  {items.map((item) => {
                    const key = `${item.type}:${item.id}`;
                    const deleting = deletingKey === key;
                    const typeLabel =
                      item.type === "learned"
                        ? "Learned from chats"
                        : "Asked to remember";
                    return (
                      <li
                        key={key}
                        className={`group flex items-start gap-3 rounded-xl px-3 py-3 transition-[opacity,transform,background-color] duration-200 ease-in motion-reduce:transition-none ${
                          deleting
                            ? "pointer-events-none translate-x-2 opacity-0"
                            : "hover:bg-neutral-50"
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
                          onClick={(event) =>
                            requestItemDeletion(item, event.currentTarget)
                          }
                          disabled={deletingKey !== null}
                          className="shrink-0 rounded-lg p-2 text-fg-neutral-tertiary opacity-70 transition-colors hover:bg-red-50 hover:text-red-700 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 group-hover:opacity-100 disabled:cursor-not-allowed"
                          aria-label={`Delete ${typeLabel.toLowerCase()} memory`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {Boolean(memories.hasNextPage) && (
                <div className="flex justify-center pb-2 pt-4">
                  <button
                    type="button"
                    onClick={() => void memories.fetchNextPage()}
                    disabled={memories.isFetchingNextPage}
                    className="rounded-lg bg-brand-secondary-enabled px-4 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-wait disabled:opacity-60"
                  >
                    {memories.isFetchingNextPage ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}
            </div>

            {total > 0 && (
              <p className="text-xs font-normal text-fg-neutral-tertiary">
                Showing {items.length} of {total} memories
              </p>
            )}

            <div aria-live="polite" aria-atomic="true" className="min-h-5">
              {actionError !== null ? (
                <p className="pt-2 text-xs font-normal text-red-700">
                  {actionError}
                </p>
              ) : actionMessage !== null ? (
                <p className="pt-2 text-xs font-normal text-fg-neutral-secondary">
                  {actionMessage}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {pendingAction !== null && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/15 px-4 py-6 backdrop-blur-[1px]">
            <section
              ref={confirmDialogRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="memory-confirm-title"
              aria-describedby="memory-confirm-description"
              className="relative w-full max-w-sm rounded-2xl border border-stroke-neutral-1 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.16)]"
            >
              <button
                type="button"
                onClick={closeConfirmation}
                className="absolute right-3 top-3 rounded-lg p-1 text-fg-neutral-tertiary transition-colors hover:bg-neutral-100 hover:text-fg-neutral-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
                aria-label="Close deletion confirmation"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <h3
                id="memory-confirm-title"
                className="pr-8 text-base font-medium text-fg-neutral-primary"
              >
                {confirmationTitle}
              </h3>
              <p
                id="memory-confirm-description"
                className="mt-2 text-sm font-normal leading-5 text-fg-neutral-secondary"
              >
                {confirmationDescription}
              </p>

              {pendingAction.kind === "item" && (
                <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg py-1 text-sm font-normal text-fg-neutral-secondary">
                  <input
                    type="checkbox"
                    checked={dontShowAgain}
                    onChange={(event) => setDontShowAgain(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
                  />
                  <span>Don't show this confirmation again on this device</span>
                </label>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  ref={cancelButtonRef}
                  type="button"
                  onClick={closeConfirmation}
                  className="rounded-lg border border-stroke-neutral-1 px-3.5 py-2 text-sm font-medium text-fg-neutral-primary transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPendingAction}
                  className="rounded-lg bg-red-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                >
                  Confirm
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
