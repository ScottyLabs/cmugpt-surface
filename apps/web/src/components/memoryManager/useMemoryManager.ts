import type { RefObject } from "react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import type { components } from "@cmugpt-frontend/server/build/openapi";
import { $api } from "@/lib/api/client.ts";
import { useAuth } from "@/integrations/auth/AuthProvider.tsx";
import { shouldSkipDeleteConfirmation } from "@/lib/memoryPreferences.ts";
import { buildOps } from "./memoryOps.ts";

export type MemoryType = components["schemas"]["AgentMemoryType"];
export type MemoryFilter = "all" | MemoryType;
export type MemoryItem = components["schemas"]["AgentMemoryItem"];

export type PendingAction =
  | { kind: "item"; item: MemoryItem }
  | { kind: "all" };

export const FILTERS: { value: MemoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "learned", label: "Learned" },
  { value: "remembered", label: "Remembered" },
];

function useMemoryQuery(
  open: boolean,
  deferredSearch: string,
  filter: MemoryFilter,
) {
  return $api.useInfiniteQuery(
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
}

function useMemoryRefs() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const confirmDialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pendingActionRef = useRef<PendingAction | null>(null);
  return {
    searchInputRef,
    dialogRef,
    dialogContentRef,
    confirmDialogRef,
    cancelButtonRef,
    actionTriggerRef,
    pendingActionRef,
  };
}

export type MemoryRefs = ReturnType<typeof useMemoryRefs>;

/** Wrap Tab/Shift+Tab around the active dialog's focusable elements. */
function trapTabKey(event: KeyboardEvent, focusRoot: HTMLElement): void {
  const focusable = Array.from(
    focusRoot.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  );
  const [first] = focusable;
  const last = focusable.at(-1);
  if (first === undefined || last === undefined) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/** While a confirmation is up, the manager behind it goes inert and focus
 *  jumps to the safe Cancel action. */
function useConfirmInert(
  pendingAction: PendingAction | null,
  refs: MemoryRefs,
): void {
  useEffect(() => {
    refs.pendingActionRef.current = pendingAction;
    if (refs.dialogContentRef.current) {
      refs.dialogContentRef.current.inert = pendingAction !== null;
    }
    if (pendingAction === null) return () => {};
    const frame = requestAnimationFrame(() =>
      refs.cancelButtonRef.current?.focus()
    );
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [pendingAction, refs]);
}

/** Escape closes (confirmation first, then the manager), Tab stays trapped,
 *  and on unmount focus returns to where it came from. */
function useDialogKeyboard(
  open: boolean,
  onClose: () => void,
  refs: MemoryRefs,
  cancelConfirmationRef: RefObject<() => void>,
  returnFocusRef?: RefObject<HTMLButtonElement | null>,
): void {
  useEffect(() => {
    if (!open) return () => {};
    const previouslyFocused = document.activeElement;
    // Read once here: the ref must not be dereferenced inside cleanup.
    const returnFocusTarget = returnFocusRef?.current;
    const frame = requestAnimationFrame(() =>
      refs.searchInputRef.current?.focus()
    );
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (refs.pendingActionRef.current === null) {
          onClose();
        } else {
          cancelConfirmationRef.current();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusRoot = refs.pendingActionRef.current === null
        ? refs.dialogRef.current
        : refs.confirmDialogRef.current;
      if (!focusRoot) return;
      trapTabKey(event, focusRoot);
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
        returnFocusTarget?.focus();
      }
    };
  }, [open, onClose, returnFocusRef, refs, cancelConfirmationRef]);
}

function useActionState(userSub: string | undefined) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [skipDeleteConfirmation, setSkipDeleteConfirmation] = useState(() =>
    shouldSkipDeleteConfirmation(userSub)
  );
  return {
    actionError,
    setActionError,
    actionMessage,
    setActionMessage,
    deletingKey,
    setDeletingKey,
    pendingAction,
    setPendingAction,
    dontShowAgain,
    setDontShowAgain,
    skipDeleteConfirmation,
    setSkipDeleteConfirmation,
  };
}

export type ActionState = ReturnType<typeof useActionState>;
export type Memories = ReturnType<typeof useMemoryQuery>;

export function useMemoryManager(
  open: boolean,
  onClose: () => void,
  returnFocusRef?: RefObject<HTMLButtonElement | null>,
) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MemoryFilter>("all");
  const deferredSearch = useDeferredValue(search.trim());
  const auth = useAuth();
  const userSub = auth.user?.sub;
  const action = useActionState(userSub);
  const refs = useMemoryRefs();
  const memories = useMemoryQuery(open, deferredSearch, filter);
  const deleteMemory = $api.useMutation("delete", "/me/memories/{kind}/{id}");
  const clearMemories = $api.useMutation("delete", "/me/memories");
  const ops = buildOps({
    action,
    refs,
    memories,
    userSub,
    deleteCall: (item) =>
      deleteMemory.mutateAsync({
        params: { path: { kind: item.type, id: item.id } },
      }),
    clearCall: () => clearMemories.mutateAsync({}),
  });
  const cancelConfirmationRef = useRef(ops.closeConfirmation);
  cancelConfirmationRef.current = ops.closeConfirmation;
  useConfirmInert(action.pendingAction, refs);
  useDialogKeyboard(open, onClose, refs, cancelConfirmationRef, returnFocusRef);

  const pages = memories.data?.pages ?? [];
  const items: MemoryItem[] = pages.flatMap((page) => page.items);
  const total = pages[0]?.total ?? 0;
  return {
    onClose,
    search,
    setSearch,
    filter,
    setFilter,
    deferredSearch,
    action,
    refs,
    memories,
    clearPending: clearMemories.isPending,
    ops,
    items,
    total,
  };
}

export type MemoryManagerController = ReturnType<typeof useMemoryManager>;
