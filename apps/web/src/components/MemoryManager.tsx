import type { RefObject } from "react";
import { useMemoryManager } from "./memoryManager/useMemoryManager.ts";
import { ConfirmOverlay } from "./memoryManager/confirm.tsx";
import {
  ManagerFilterRow,
  ManagerHeader,
  ManagerList,
  ManagerSearch,
  ManagerStatus,
} from "./memoryManager/views.tsx";

interface MemoryManagerProps {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}

export function MemoryManager({
  open,
  onClose,
  returnFocusRef,
}: MemoryManagerProps) {
  const mm = useMemoryManager(open, onClose, returnFocusRef);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close memories"
        className="absolute inset-0 h-full w-full bg-[rgba(245,245,245,0.75)] backdrop-blur-[3.55px]"
        onClick={() => {
          if (mm.action.pendingAction === null) onClose();
        }}
      />
      <section
        ref={mm.refs.dialogRef}
        // A native <dialog> brings its own backdrop, UA styles, and
        // showModal lifecycle; this modal implements those itself.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-manager-title"
        aria-describedby="memory-manager-description"
        className="relative flex max-h-[min(44rem,calc(100dvh-3rem))] w-full max-w-[45.5625rem] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_6px_0_rgba(0,0,0,0.20)]"
      >
        <div ref={mm.refs.dialogContentRef} className="contents">
          <ManagerHeader onClose={onClose} />
          <div className="flex min-h-0 flex-1 flex-col px-6 pb-6 sm:px-8 sm:pb-8">
            <ManagerSearch mm={mm} />
            <ManagerFilterRow mm={mm} />
            <ManagerList mm={mm} />
            <ManagerStatus mm={mm} />
          </div>
        </div>
        <ConfirmOverlay mm={mm} />
      </section>
    </div>
  );
}
