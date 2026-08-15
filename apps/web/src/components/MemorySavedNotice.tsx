import { Brain, LoaderCircle, Sparkles, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { $api } from "@/lib/api/client.ts";
import { useAuth } from "@/integrations/auth/AuthProvider.tsx";
import type { SavedMemory } from "@/components/chat/types.ts";
import { useCloseOnOutsideOrEscape } from "@/components/ModelSelector.tsx";
import {
  rememberDeleteConfirmationPreference,
  shouldSkipDeleteConfirmation,
} from "@/lib/memoryPreferences.ts";
import { waitForMotion } from "@/lib/reducedMotion.ts";

interface MemorySavedNoticeProps {
  memory: SavedMemory;
  onDeleted: () => void;
}

type NoticePhase = "saved" | "deleting" | "deleted";

const EXIT_ANIMATION_MS = 320;

interface ChipPhaseControls {
  setPhase: (phase: NoticePhase) => void;
  setError: (error: string | null) => void;
}

/** Runs the delete call, the exit animation, then the removal callback. */
async function runChipDeletion(
  memory: SavedMemory,
  onDeleted: () => void,
  deleteCall: () => Promise<unknown>,
  controls: ChipPhaseControls,
): Promise<void> {
  controls.setError(null);
  controls.setPhase("deleting");
  try {
    await deleteCall();
    controls.setPhase("deleted");
    await waitForMotion(EXIT_ANIMATION_MS);
    onDeleted();
  } catch {
    controls.setPhase("saved");
    controls.setError("That memory could not be deleted. Try again.");
  }
}

/** Deletion state machine for one chip: menu, optional confirmation (with a
 *  per-device skip preference), the delete call, and the exit animation. */
function useChipDeletion(memory: SavedMemory, onDeleted: () => void) {
  const auth = useAuth();
  const userSub = auth.user?.sub;
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [phase, setPhase] = useState<NoticePhase>("saved");
  const [error, setError] = useState<string | null>(null);
  const deleteMemory = $api.useMutation("delete", "/me/memories/{kind}/{id}");

  async function removeMemory() {
    if (phase !== "saved") return;
    setActionsOpen(false);
    setConfirmationOpen(false);
    await runChipDeletion(
      memory,
      onDeleted,
      () =>
        deleteMemory.mutateAsync({
          params: { path: { kind: memory.kind, id: memory.id } },
        }),
      { setPhase, setError },
    );
  }

  return {
    confirmationOpen,
    setConfirmationOpen,
    actionsOpen,
    setActionsOpen,
    dontShowAgain,
    setDontShowAgain,
    phase,
    error,
    setError,
    userSub,
    removeMemory,
  };
}

type ChipState = ReturnType<typeof useChipDeletion>;

/** Menu's delete entry: skip straight to deletion when the device opted out
 *  of the confirmation, otherwise open the confirm dialog. */
function requestChipDeletion(chip: ChipState): void {
  chip.setActionsOpen(false);
  if (shouldSkipDeleteConfirmation(chip.userSub)) {
    void chip.removeMemory();
    return;
  }
  chip.setError(null);
  chip.setDontShowAgain(false);
  chip.setConfirmationOpen(true);
}

function confirmChipDeletion(chip: ChipState): void {
  if (chip.dontShowAgain) rememberDeleteConfirmationPreference(chip.userSub);
  void chip.removeMemory();
}

type ChipDeletion = ChipState;

function ChipButton({ memory, chip }: { memory: SavedMemory; chip: ChipDeletion }) {
  const deleting = chip.phase === "deleting";
  return (
    <button
      type="button"
      onClick={() => {
        if (deleting) return;
        chip.setError(null);
        chip.setConfirmationOpen(false);
        chip.setActionsOpen((open) => !open);
      }}
      disabled={deleting}
      title="Memory options"
      aria-label={`Memory saved: ${memory.fact}. Open memory options.`}
      aria-haspopup="menu"
      aria-expanded={chip.actionsOpen || chip.confirmationOpen}
      className="group -ml-1 inline-flex h-6 max-w-full items-center gap-1 rounded-md pl-1 pr-2.5 text-left text-[0.6875rem] font-medium text-fg-neutral-tertiary transition-[background-color,color,opacity] hover:bg-neutral-100 hover:text-fg-neutral-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-wait disabled:opacity-60"
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
      <span className="whitespace-nowrap">{deleting ? "Removing memory..." : "Memory saved"}</span>
    </button>
  );
}

function ChipMenu({ memory, chip }: { memory: SavedMemory; chip: ChipDeletion }) {
  return (
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
        onClick={() => {
          requestChipDeletion(chip);
        }}
        className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        Delete memory
      </button>
    </div>
  );
}

function ChipConfirmControls({ chip }: { chip: ChipDeletion }) {
  return (
    <>
      <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs font-normal text-fg-neutral-secondary">
        <input
          type="checkbox"
          checked={chip.dontShowAgain}
          onChange={(event) => {
            chip.setDontShowAgain(event.target.checked);
          }}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
        />
        <span>Don&apos;t show this confirmation again on this device</span>
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            chip.setConfirmationOpen(false);
          }}
          className="rounded-lg border border-stroke-neutral-1 px-3 py-1.5 text-xs font-medium text-fg-neutral-primary transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            confirmChipDeletion(chip);
          }}
          className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          Confirm
        </button>
      </div>
    </>
  );
}

function ChipConfirmDialog({ memory, chip }: { memory: SavedMemory; chip: ChipDeletion }) {
  return (
    <section
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="inline-memory-delete-title"
      aria-describedby="inline-memory-delete-description"
      className="absolute bottom-full left-0 z-30 mb-1 w-[min(20rem,calc(100vw-3rem))] rounded-xl border border-stroke-neutral-1 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
    >
      <button
        type="button"
        onClick={() => {
          chip.setConfirmationOpen(false);
        }}
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
        CMUGPT will stop using &quot;{memory.fact}&quot; in future replies.
      </p>
      <ChipConfirmControls chip={chip} />
    </section>
  );
}

export function MemorySavedNotice({ memory, onDeleted }: MemorySavedNoticeProps) {
  const chip = useChipDeletion(memory, onDeleted);
  const containerRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsideOrEscape(
    chip.actionsOpen || chip.confirmationOpen,
    () => {
      chip.setActionsOpen(false);
      chip.setConfirmationOpen(false);
    },
    containerRef,
  );

  const leaving = chip.phase === "deleted";
  return (
    <div
      ref={containerRef}
      className={`memory-saved-enter relative -mb-1 h-6 w-fit max-w-full transition-[height,margin,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        leaving ? "pointer-events-none mb-0 h-0 -translate-y-1 opacity-0" : "opacity-100"
      }`}
    >
      <ChipButton memory={memory} chip={chip} />
      {chip.actionsOpen ? <ChipMenu memory={memory} chip={chip} /> : null}
      {chip.confirmationOpen ? <ChipConfirmDialog memory={memory} chip={chip} /> : null}
      {chip.error === null || chip.error === "" ? null : (
        <p
          className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-red-100 bg-white px-2 py-1.5 text-xs text-red-700 shadow-sm"
          aria-live="polite"
        >
          {chip.error}
        </p>
      )}
    </div>
  );
}
