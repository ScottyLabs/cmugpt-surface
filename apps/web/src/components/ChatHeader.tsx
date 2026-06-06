import { LockOpen } from "lucide-react";
import { PinIcon, UnpinIcon } from "@/components/icons/ChatIcons.tsx";
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
  chatId,
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
        {!isNewChatIntent && currentChatTitle ? (
          <span className="truncate text-black text-lg font-medium leading-relaxed">
            {currentChatTitle}
          </span>
        ) : null}
      </div>
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
        {Boolean(chatId) && currentChat != null && (
          <button
            type="button"
            onClick={() => toggleStarChat(currentChat.id, !currentChat.starred)}
            className="mr-3 flex flex-row items-center gap-2 rounded-sm border border-stroke-neutral-1 bg-white px-2.5 py-1.5 hover:bg-neutral-50"
            aria-label={currentChat.starred ? "Unstar" : "Star"}
          >
            {currentChat.starred ? (
              <>
                <UnpinIcon />
                <span className="text-fg-neutral-primary text-sm font-semibold">
                  Unpin chat
                </span>
              </>
            ) : (
              <>
                <PinIcon />
                <span className="text-fg-neutral-primary text-sm font-semibold">
                  Pin chat
                </span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
