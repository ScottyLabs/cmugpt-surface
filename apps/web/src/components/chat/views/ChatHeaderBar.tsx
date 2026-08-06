import { LockOpen } from "lucide-react";
import { SidebarPanelIcon } from "@/components/icons/index.tsx";
import { ModelSelector } from "../../ModelSelector.tsx";
import type { ChatShellController } from "../useChatShell.ts";

function MobileSidebarToggle({ c }: { c: ChatShellController }) {
  const { setSidebarOpen } = c;
  return (
    <button
      type="button"
      onClick={() => {
        setSidebarOpen(true);
      }}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-200/80 hover:text-neutral-800 md:hidden"
      aria-label="Open sidebar"
    >
      <SidebarPanelIcon />
    </button>
  );
}

function HeaderBrand({ c }: { c: ChatShellController }) {
  const { sidebarOpen } = c;
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
      <MobileSidebarToggle c={c} />
      {!sidebarOpen && (
        <div className="flex min-w-0 items-center gap-1.5">
          <img
            src="/sl-logo.svg"
            alt=""
            className="h-6 w-6 shrink-0 object-contain"
            width={24}
            height={24}
          />
          <span className="truncate text-lg font-semibold leading-none tracking-tight">CMUGPT</span>
        </div>
      )}
      <div className="ml-2 hidden sm:block">
        <ModelSelector />
      </div>
    </div>
  );
}

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
      disabled={
        session.chatId === undefined ||
        derived.effectiveChatDetail === undefined ||
        mutations.patchChat.isPending
      }
      className="min-w-[5.5rem] rounded-lg px-2 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
      aria-label={shareLabel(share.shareFeedback)}
    >
      <span className="inline-flex items-center gap-1">
        <span aria-hidden>↗</span>
        {share.shareFeedback === "copied"
          ? "Copied"
          : share.shareFeedback === "shared"
            ? "Shared"
            : "Share"}
      </span>
    </button>
  );
}

function HeaderActions({ c }: { c: ChatShellController }) {
  const { derived, share, mutations, session, sidebar } = c;
  const { chatId } = session;
  const { currentChat } = derived;
  return (
    <div className="flex shrink-0 items-center gap-2">
      {derived.showMakePrivate ? (
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
      ) : null}
      <ShareButton c={c} />
      {Boolean(chatId) && currentChat !== undefined && (
        <button
          type="button"
          onClick={() => {
            sidebar.toggleStarChat(currentChat.id, !currentChat.starred);
          }}
          className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100"
          aria-label={currentChat.starred ? "Unstar" : "Star"}
        >
          {currentChat.starred ? "★" : "☆"}
        </button>
      )}
    </div>
  );
}

export function ChatHeaderBar({ c }: { c: ChatShellController }) {
  const { derived, session } = c;
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-neutral-200 px-3 sm:px-4">
      <HeaderBrand c={c} />
      {(derived.shouldShowConversation || session.chatsLoading || session.isNewChatIntent) && (
        <span className="min-w-0 flex-1 truncate text-center text-black text-lg font-medium leading-relaxed">
          {derived.currentChat?.title}
        </span>
      )}
      <HeaderActions c={c} />
    </header>
  );
}
