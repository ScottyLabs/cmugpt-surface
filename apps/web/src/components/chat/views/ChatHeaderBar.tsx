import { LockOpen } from "lucide-react";
import type { ChatShellController } from "../useChatShell.ts";
import { SidebarOpenButton } from "./SidebarOpenButton.tsx";

function shareLabel(shareFeedback: "copied" | "shared" | null): string {
  if (shareFeedback === "copied") {
    return "Chat link copied to clipboard";
  }
  if (shareFeedback === "shared") {
    return "Chat link shared";
  }
  return "Share chat link";
}

function ShareButton({ c }: { c: ChatShellController }) {
  const { derived, share, mutations, session } = c;
  return (
    <button
      type="button"
      onClick={() => {
        void share.shareChat();
      }}
      disabled={session.chatId === undefined ||
        derived.effectiveChatDetail === undefined ||
        mutations.patchChat.isPending}
      className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
      aria-label={shareLabel(share.shareFeedback)}
    >
      <span aria-hidden>↗</span>
      {share.shareFeedback === "copied"
        ? "Copied"
        : share.shareFeedback === "shared"
        ? "Shared"
        : "Share"}
    </button>
  );
}

function HeaderActions({ c }: { c: ChatShellController }) {
  const { derived, share, mutations, session, sidebar } = c;
  const { chatId } = session;
  const { currentChat } = derived;
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {derived.showMakePrivate
        ? (
          <button
            type="button"
            onClick={() => {
              share.makeChatPrivate();
            }}
            disabled={mutations.patchChat.isPending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
            title="Anyone signed in can open this link. Click to make the chat private again."
            aria-label="Make chat private"
          >
            <LockOpen className="h-4 w-4" aria-hidden />
          </button>
        )
        : null}
      <ShareButton c={c} />
      {Boolean(chatId) && currentChat !== undefined && (
        <button
          type="button"
          onClick={() => {
            sidebar.toggleStarChat(currentChat.id, !currentChat.starred);
          }}
          className="rounded-lg p-2 text-lg leading-none text-neutral-600 hover:bg-neutral-100"
          aria-label={currentChat.starred ? "Unstar" : "Star"}
        >
          {currentChat.starred ? "★" : "☆"}
        </button>
      )}
    </div>
  );
}

/**
 * Floating overlay instead of a solid bar: only the corner controls are drawn,
 * so the conversation scrolls all the way to the top underneath them. The
 * container is click-through (pointer-events-none) except over the controls.
 */
export function ChatHeaderBar({ c }: { c: ChatShellController }) {
  const { sidebarOpen } = c;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 sm:p-4">
      <div className="pointer-events-auto">
        {
          /* The desktop collapsed rail carries its own open button, so the header
            only needs one on mobile, where the sidebar is off-screen. */
        }
        {!sidebarOpen && <SidebarOpenButton c={c} className="md:hidden" />}
      </div>
      <div className="pointer-events-auto">
        <HeaderActions c={c} />
      </div>
    </div>
  );
}
