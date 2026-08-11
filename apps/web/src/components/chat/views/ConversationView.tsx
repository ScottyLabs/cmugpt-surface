import type { ChatShellController } from "../useChatShell.ts";
import { MessageList } from "./MessageList.tsx";
import { WelcomeScreen } from "./WelcomeScreen.tsx";

export function ConversationView({ c }: { c: ChatShellController }) {
  const { session, derived, scroll } = c;
  // Show the centered greeting for any empty chat, including right after
  // clicking New Chat, until the first message starts a conversation.
  const showWelcome = !derived.shouldShowConversation &&
    !session.chatsLoading && session.chatId === undefined;
  return (
    <div
      ref={scroll.scrollContainerRef}
      className={`min-h-0 flex-1 overflow-y-auto px-4 flex flex-col ${
        showWelcome ? "justify-center py-6" : "justify-start pt-6 pb-2"
      }`}
      onScroll={scroll.onScroll}
    >
      {showWelcome && <WelcomeScreen c={c} />}
      {derived.showMessagesLoading
        ? <p className="text-neutral-500 text-sm">Loading messages...</p>
        : null}
      {derived.shouldShowConversation && !derived.showMessagesLoading && (
        <MessageList c={c} />
      )}
    </div>
  );
}
