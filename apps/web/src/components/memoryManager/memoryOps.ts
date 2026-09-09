import { rememberDeleteConfirmationPreference } from "@/lib/memoryPreferences.ts";
import { waitForMotion } from "@/lib/reducedMotion.ts";
import type { ActionState, Memories, MemoryItem, MemoryRefs } from "./useMemoryManager.ts";

const DELETE_TRANSITION_MS = 180;

export interface OpsDeps {
  action: ActionState;
  refs: MemoryRefs;
  memories: Memories;
  userSub: string | undefined;
  deleteCall: (item: MemoryItem) => Promise<unknown>;
  clearCall: () => Promise<unknown>;
}

async function removeItemOp(item: MemoryItem, deps: OpsDeps): Promise<void> {
  const { action, memories } = deps;
  const key = `${item.type}:${item.id}`;
  action.setActionError(null);
  action.setActionMessage(null);
  action.setDeletingKey(key);
  try {
    // The exit animation and the DELETE round-trip are independent, so
    // they run concurrently.
    await Promise.all([waitForMotion(DELETE_TRANSITION_MS), deps.deleteCall(item)]);
    await memories.refetch();
    action.setActionMessage("Memory deleted.");
  } catch {
    action.setActionError("That memory could not be deleted. Please try again.");
  } finally {
    action.setDeletingKey(null);
  }
}

async function clearAllOp(deps: OpsDeps): Promise<void> {
  const { action, memories } = deps;
  action.setActionError(null);
  action.setActionMessage(null);
  try {
    await deps.clearCall();
    await memories.refetch();
    action.setActionMessage("All memories cleared.");
  } catch {
    action.setActionError("Your memories could not be cleared. Please try again.");
  }
}

function confirmOp(deps: OpsDeps): void {
  const { action, refs } = deps;
  const current = action.pendingAction;
  if (current === null) return;
  if (current.kind === "item" && action.dontShowAgain) {
    rememberDeleteConfirmationPreference(deps.userSub);
    action.setSkipDeleteConfirmation(true);
  }
  action.setPendingAction(null);
  action.setDontShowAgain(false);
  requestAnimationFrame(() => refs.searchInputRef.current?.focus());
  if (current.kind === "item") {
    void removeItemOp(current.item, deps);
  } else {
    void clearAllOp(deps);
  }
}

export function buildOps(deps: OpsDeps) {
  const { action, refs } = deps;
  function closeConfirmation() {
    action.setPendingAction(null);
    action.setDontShowAgain(false);
    const trigger = refs.actionTriggerRef.current;
    requestAnimationFrame(() => trigger?.focus());
  }
  function requestItemDeletion(item: MemoryItem, trigger: HTMLButtonElement) {
    if (action.deletingKey !== null) return;
    refs.actionTriggerRef.current = trigger;
    action.setActionError(null);
    action.setActionMessage(null);
    if (action.skipDeleteConfirmation) {
      requestAnimationFrame(() => refs.searchInputRef.current?.focus());
      void removeItemOp(item, deps);
      return;
    }
    action.setDontShowAgain(false);
    action.setPendingAction({ kind: "item", item });
  }
  function requestClearAll(trigger: HTMLButtonElement) {
    refs.actionTriggerRef.current = trigger;
    action.setActionError(null);
    action.setActionMessage(null);
    action.setDontShowAgain(false);
    action.setPendingAction({ kind: "all" });
  }
  return {
    closeConfirmation,
    requestItemDeletion,
    requestClearAll,
    confirmPendingAction: () => {
      confirmOp(deps);
    },
  };
}
