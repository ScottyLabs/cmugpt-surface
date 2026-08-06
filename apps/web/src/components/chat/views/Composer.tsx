import { SendIcon } from "@/components/icons/index.tsx";
import type { ChatShellController } from "../useChatShell.ts";

interface ComposerProps {
  c: ChatShellController;
  rowClassName: string;
  textareaClassName: string;
}

export function Composer({ c, rowClassName, textareaClassName }: ComposerProps) {
  const { draft, setDraft, draftComposerRef, send } = c.composer;
  const { chatId } = c.session;
  const streaming = c.stream.isStreaming;
  const lockedForChat = Boolean(chatId) && !c.derived.canEditChat;
  const nothingToSend = draft.trim() === "" && c.attachments.pendingAttachments.length === 0;
  return (
    <div className={rowClassName}>
      <textarea
        ref={draftComposerRef}
        rows={1}
        placeholder="How can I help you today?"
        value={draft}
        disabled={streaming || lockedForChat}
        onChange={(e) => {
          setDraft(e.target.value);
          c.attachments.setAttachmentHint(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
        className={textareaClassName}
      />
      <button
        type="button"
        onClick={() => {
          void send();
        }}
        disabled={streaming || c.mutations.createChat.isPending || lockedForChat || nothingToSend}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-neutral-200 disabled:opacity-35"
        aria-label="Send"
      >
        <SendIcon />
      </button>
    </div>
  );
}
