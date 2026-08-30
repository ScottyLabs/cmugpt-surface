import { X } from "lucide-react";
import type { MemoryManagerController } from "./useMemoryManager.ts";

function ConfirmSkipCheckbox({ mm }: { mm: MemoryManagerController }) {
  return (
    <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg py-1 text-sm font-normal text-fg-neutral-secondary">
      <input
        type="checkbox"
        checked={mm.action.dontShowAgain}
        onChange={(event) => {
          mm.action.setDontShowAgain(event.target.checked);
        }}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
      />
      <span>Don&apos;t show this confirmation again on this device</span>
    </label>
  );
}

function ConfirmButtons({ mm }: { mm: MemoryManagerController }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button
        ref={mm.refs.cancelButtonRef}
        type="button"
        onClick={mm.ops.closeConfirmation}
        className="rounded-lg border border-stroke-neutral-1 px-3.5 py-2 text-sm font-medium text-fg-neutral-primary transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={mm.ops.confirmPendingAction}
        className="rounded-lg bg-red-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
      >
        Confirm
      </button>
    </div>
  );
}

export function ConfirmOverlay({ mm }: { mm: MemoryManagerController }) {
  const pending = mm.action.pendingAction;
  if (pending === null) return null;
  const title = pending.kind === "all" ? "Clear all memories?" : "Delete this memory?";
  const description =
    pending.kind === "all"
      ? "This removes every learned and remembered fact Bark uses to personalize replies."
      : "Bark will stop using this fact to personalize future replies.";
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/15 px-4 py-6 backdrop-blur-[1px]">
      <section
        ref={mm.refs.confirmDialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="memory-confirm-title"
        aria-describedby="memory-confirm-description"
        className="relative w-full max-w-sm rounded-2xl border border-stroke-neutral-1 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.16)]"
      >
        <button
          type="button"
          onClick={mm.ops.closeConfirmation}
          className="absolute right-3 top-3 rounded-lg p-1 text-fg-neutral-tertiary transition-colors hover:bg-neutral-100 hover:text-fg-neutral-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
          aria-label="Close deletion confirmation"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <h3
          id="memory-confirm-title"
          className="pr-8 text-base font-medium text-fg-neutral-primary"
        >
          {title}
        </h3>
        <p
          id="memory-confirm-description"
          className="mt-2 text-sm font-normal leading-5 text-fg-neutral-secondary"
        >
          {description}
        </p>
        {pending.kind === "item" && <ConfirmSkipCheckbox mm={mm} />}
        <ConfirmButtons mm={mm} />
      </section>
    </div>
  );
}
