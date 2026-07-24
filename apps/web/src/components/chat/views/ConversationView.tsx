import type { ChatShellController } from "../useChatShell.ts";
import { MessageList } from "./MessageList.tsx";
import { WelcomeScreen } from "./WelcomeScreen.tsx";

export function ConversationView({ c }: { c: ChatShellController }) {
  const { session, derived, scroll } = c;
  const showWelcome =
    !derived.shouldShowConversation &&
    !session.chatsLoading &&
    session.chatId === undefined &&
    !session.isNewChatIntent;
  return (
    <div
      ref={scroll.scrollContainerRef}
      className={`min-h-0 flex-1 overflow-y-auto px-4 py-6 flex flex-col ${
        showWelcome ? "justify-center" : "justify-start"
      }`}
      onScroll={scroll.onScroll}
    >
      {showWelcome && <WelcomeScreen c={c} />}
      {derived.showMessagesLoading ? (
        <p className="text-neutral-500 text-sm">Loading messages...</p>
      ) : null}
      {derived.shouldShowConversation && !derived.showMessagesLoading && <MessageList c={c} />}
    </div>
  );
}
