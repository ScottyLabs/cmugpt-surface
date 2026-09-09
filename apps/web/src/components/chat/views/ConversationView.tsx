import type { ChatShellController } from "../useChatShell.ts";
import { MessageList } from "./MessageList.tsx";
import { WelcomeScreen } from "./WelcomeScreen.tsx";

export function ConversationView({ c }: { c: ChatShellController }) {
  const { session, derived, scroll } = c;
  // Show the centered greeting for any empty chat, including right after
  // clicking New Chat, until the first message starts a conversation.
  const showWelcome =
    !derived.shouldShowConversation && !session.chatsLoading && session.chatId === undefined;
  return (
    <div
      ref={scroll.scrollContainerRef}
      className={`min-h-0 flex-1 overflow-y-auto px-4 flex flex-col ${
        showWelcome ? "justify-center py-6" : "justify-start pt-2 pb-2 md:pt-20"
      }`}
      onScroll={scroll.onScroll}
    >
      {showWelcome && <WelcomeScreen c={c} />}
      {derived.showMessagesLoading ? (
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-neutral-500 text-sm transition-opacity delay-300 duration-200 starting:opacity-0">
            Loading messages...
          </p>
        </div>
      ) : null}
      {derived.shouldShowConversation && !derived.showMessagesLoading && <MessageList c={c} />}
    </div>
  );
}
