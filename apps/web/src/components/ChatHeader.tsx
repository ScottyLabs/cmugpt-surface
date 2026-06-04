import { LockOpen } from "lucide-react";
import { ModelSelector } from "./ModelSelector.tsx";

interface ChatHeaderProps {
  sidebarOpen: boolean;
  showMakePrivate: boolean;
  makeChatPrivate: () => void;
  patchChatIsPending: boolean;
  shareChat: () => void;
  chatId: string | undefined;
  effectiveChatDetailExists: boolean;
  shareFeedback: null | "copied" | "shared";
  currentChat: { id: string; starred: boolean } | undefined;
  toggleStarChat: (id: string, next: boolean) => void;
  isNewChatIntent: boolean;
  currentChatTitle: string | undefined;
}

export function ChatHeader({
  sidebarOpen,
  showMakePrivate,
  makeChatPrivate,
  patchChatIsPending,
  shareChat,
  chatId,
  effectiveChatDetailExists,
  shareFeedback,
  currentChat,
  toggleStarChat,
  isNewChatIntent,
  currentChatTitle,
}: ChatHeaderProps) {
  return (
    <header className="mt-3 flex h-14 shrink-0 items-center justify-between px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        {!sidebarOpen && (
          <div className="ml-3 flex min-w-0 items-center gap-1.5">
            <img
              src="/sl-logo.svg"
              alt=""
              className="h-6 w-6 shrink-0 object-contain"
              width={24}
              height={24}
            />
            <span className="truncate text-lg font-semibold leading-none tracking-tight">
              CMUGPT
            </span>
          </div>
        )}
        <div className="ml-2 mr-2 hidden sm:block">
          <ModelSelector />
        </div>
      </div>
      {isNewChatIntent ? (
        <span className="text-black text-lg font-medium leading-relaxed">
          {currentChatTitle}
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        {showMakePrivate ? (
          <button
            type="button"
            onClick={() => makeChatPrivate()}
            disabled={patchChatIsPending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
            title="Anyone signed in can open this link. Click to make the chat private again."
            aria-label="Make chat private"
          >
            <LockOpen className="h-4 w-4" aria-hidden={true} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void shareChat()}
          disabled={!chatId || !effectiveChatDetailExists || patchChatIsPending}
          className="min-w-[5.5rem] rounded-lg px-2 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
          aria-label={
            shareFeedback === "copied"
              ? "Chat link copied to clipboard"
              : shareFeedback === "shared"
                ? "Chat link shared"
                : "Share chat link"
          }
        >
          <span className="inline-flex items-center gap-1">
            <span aria-hidden={true}>↗</span>
            {shareFeedback === "copied"
              ? "Copied"
              : shareFeedback === "shared"
                ? "Shared"
                : "Share"}
          </span>
        </button>
        {Boolean(chatId) && currentChat != null && (
          <button
            type="button"
            onClick={() => toggleStarChat(currentChat.id, !currentChat.starred)}
            className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100"
            aria-label={currentChat.starred ? "Unstar" : "Star"}
          >
            {currentChat.starred ? "★" : "☆"}
          </button>
        )}
      </div>
    </header>
  );
}
