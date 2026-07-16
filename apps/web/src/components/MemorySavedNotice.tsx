import { Brain, LoaderCircle, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { $api } from "@/lib/api/client.ts";
import type { SavedMemoryNotice } from "@/lib/chatUtils.ts";
import {
  rememberDeleteConfirmationPreference,
  shouldSkipDeleteConfirmation,
} from "@/lib/memoryPreferences.ts";

interface MemorySavedNoticeProps {
  memory: SavedMemoryNotice;
  onDeleted: (id: string) => void;
}

type NoticePhase = "saved" | "deleting" | "deleted";

function waitForExitAnimation(): Promise<void> {
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve) => window.setTimeout(resolve, 320));
}

export function MemorySavedNotice({
  memory,
  onDeleted,
}: MemorySavedNoticeProps) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [phase, setPhase] = useState<NoticePhase>("saved");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const deleteMemory = $api.useMutation("delete", "/me/memories/{kind}/{id}");

  useEffect(() => {
    if (!actionsOpen && !confirmationOpen) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setActionsOpen(false);
        setConfirmationOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActionsOpen(false);
        setConfirmationOpen(false);
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [actionsOpen, confirmationOpen]);

  async function removeMemory() {
    if (phase !== "saved") return;
    setActionsOpen(false);
    setConfirmationOpen(false);
    setError(null);
    setPhase("deleting");
    try {
      await deleteMemory.mutateAsync({
        params: { path: { kind: memory.kind, id: memory.id } },
      });
      setPhase("deleted");
      await waitForExitAnimation();
      onDeleted(memory.id);
    } catch {
      setPhase("saved");
      setError("That memory could not be deleted. Try again.");
    }
  }

  function requestDeletion() {
    setActionsOpen(false);
    if (shouldSkipDeleteConfirmation()) {
      void removeMemory();
      return;
    }
    setError(null);
    setDontShowAgain(false);
    setConfirmationOpen(true);
  }

  function confirmDeletion() {
    if (dontShowAgain) rememberDeleteConfirmationPreference();
    void removeMemory();
  }

  const leaving = phase === "deleted";
  const deleting = phase === "deleting";

  return (
    <div
      ref={containerRef}
      className={`memory-saved-enter relative mb-0.5 h-6 w-fit max-w-full transition-[height,margin,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        leaving
          ? "pointer-events-none mb-0 h-0 -translate-y-1 opacity-0"
          : "opacity-100"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          if (deleting) return;
          setError(null);
          setConfirmationOpen(false);
          setActionsOpen((open) => !open);
        }}
        disabled={deleting}
        title="Memory options"
        aria-label={`Memory saved: ${memory.fact}. Open memory options.`}
        aria-haspopup="menu"
        aria-expanded={actionsOpen || confirmationOpen}
        className="group inline-flex h-6 max-w-full items-center gap-1 rounded-md px-1 text-left text-[0.6875rem] font-medium text-fg-neutral-tertiary transition-[background-color,color,opacity] hover:bg-neutral-100 hover:text-fg-neutral-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-wait disabled:opacity-60"
      >
        <span className="relative flex h-4 w-4 shrink-0 items-center justify-center text-fg-neutral-secondary">
          {deleting ? (
            <LoaderCircle
              className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <>
              <Brain className="h-3.5 w-3.5" aria-hidden="true" />
              <Sparkles
                className="memory-saved-spark absolute -right-0.5 -top-1 h-2 w-2 text-sky-600"
                aria-hidden="true"
              />
            </>
          )}
        </span>
        <span className="truncate">
          {deleting ? "Removing memory…" : "Memory saved"}
        </span>
      </button>

      {actionsOpen ? (
        <div
          role="menu"
          aria-label="Memory options"
          className="absolute bottom-full left-0 z-30 mb-1 w-64 rounded-xl border border-stroke-neutral-1 bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          <p className="px-2 py-1 text-xs font-normal leading-4 text-fg-neutral-secondary">
            {memory.fact}
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={requestDeletion}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete memory
          </button>
        </div>
      ) : null}

      {confirmationOpen ? (
        <section
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="inline-memory-delete-title"
          aria-describedby="inline-memory-delete-description"
          className="absolute bottom-full left-0 z-30 mb-1 w-[min(20rem,calc(100vw-3rem))] rounded-xl border border-stroke-neutral-1 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          <button
            type="button"
            onClick={() => setConfirmationOpen(false)}
            className="absolute right-2.5 top-2.5 rounded-lg p-1 text-fg-neutral-tertiary transition-colors hover:bg-neutral-100 hover:text-fg-neutral-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
            aria-label="Close memory deletion confirmation"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <h3
            id="inline-memory-delete-title"
            className="pr-8 text-sm font-semibold text-fg-neutral-primary"
          >
            Delete this memory?
          </h3>
          <p
            id="inline-memory-delete-description"
            className="mt-1.5 text-sm font-normal leading-5 text-fg-neutral-secondary"
          >
            CMUGPT will stop using “{memory.fact}” in future replies.
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs font-normal text-fg-neutral-secondary">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
            />
            <span>Don’t show this confirmation again on this device</span>
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmationOpen(false)}
              className="rounded-lg border border-stroke-neutral-1 px-3 py-1.5 text-xs font-medium text-fg-neutral-primary transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeletion}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              Confirm
            </button>
          </div>
        </section>
      ) : null}
      {error ? (
        <p
          className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-red-100 bg-white px-2 py-1.5 text-xs text-red-700 shadow-sm"
          aria-live="polite"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
