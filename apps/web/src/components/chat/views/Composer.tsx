import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { SendIcon } from "@/components/icons/index.tsx";
import { ModelSelector } from "../../ModelSelector.tsx";
import type { ChatShellController } from "../useChatShell.ts";

/** ChatGPT-style pill composer. With a short draft everything sits on one
 *  line: textarea left, model picker + send right. Once the draft would reach
 *  the controls (or contains a newline) the controls slide down onto their own
 *  row beneath the text, and slide back up when the draft shrinks. */
function useMultilineComposer(
  draft: string,
  draftComposerRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  const [multiline, setMultiline] = useState(false);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  const recompute = useCallback(() => {
    const mirror = mirrorRef.current;
    const area = draftComposerRef.current;
    const controls = controlsRef.current;
    if (mirror === null || area === null || controls === null) {
      return;
    }
    // Room the text may use beside the inline controls (24px of breathing
    // space between text and controls, covering the textarea's own padding).
    const inlineRoom = area.clientWidth - controls.offsetWidth - 24;
    setMultiline(area.value.includes("\n") || mirror.offsetWidth > inlineRoom);
  }, [draftComposerRef]);

  // Re-measure after every draft change (the mirror re-renders first) and
  // whenever the composer is resized (window/sidebar changes).
  useLayoutEffect(() => {
    recompute();
  }, [draft, recompute]);
  useLayoutEffect(() => {
    const area = draftComposerRef.current;
    if (area === null) {
      return () => {};
    }
    const ro = new ResizeObserver(() => {
      recompute();
    });
    ro.observe(area);
    return () => {
      ro.disconnect();
    };
  }, [recompute, draftComposerRef]);

  return { multiline, mirrorRef, controlsRef };
}

export function Composer({ c }: { c: ChatShellController }) {
  const { draft, draftComposerRef, send } = c.composer;
  const { chatId } = c.session;
  const streaming = c.stream.isStreaming;
  const lockedForChat = Boolean(chatId) && !c.derived.canEditChat;
  const nothingToSend = draft.trim() === "";
  const { multiline, mirrorRef, controlsRef } = useMultilineComposer(
    draft,
    draftComposerRef,
  );

  return (
    <div className="relative mx-auto flex w-full max-w-[48.25rem] flex-col rounded-[1.75rem] border border-neutral-300/70 bg-white py-2.5 pl-2 pr-4.5 shadow-[0_0_24px_0_var(--color-brandneutral-secondary-enabled),0_0_6px_0_rgba(158,177,194,0.55)]">
      {
        /* Hidden mirror used only to measure the draft's natural width. Must
          match the textarea's text styles. */
      }
      <span
        ref={mirrorRef}
        aria-hidden
        className="invisible absolute left-0 top-0 whitespace-pre text-sm leading-relaxed"
      >
        {draft}
      </span>
      <ComposerTextarea c={c} disabled={streaming || lockedForChat} />
      <ComposerControls
        multiline={multiline}
        controlsRef={controlsRef}
        send={send}
        sendDisabled={streaming ||
          c.mutations.createChat.isPending ||
          lockedForChat ||
          nothingToSend}
      />
    </div>
  );
}

function ComposerTextarea(
  { c, disabled }: { c: ChatShellController; disabled: boolean },
) {
  const { draft, setDraft, draftComposerRef, send } = c.composer;
  return (
    <textarea
      ref={draftComposerRef}
      rows={1}
      placeholder="Message CMUGPT"
      value={draft}
      disabled={disabled}
      onChange={(e) => {
        setDraft(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          void send();
        }
      }}
      className="field-sizing-content max-h-40 w-full resize-none bg-transparent py-1.5 pl-2.5 pr-1.5 text-sm leading-relaxed text-neutral-900 outline-none placeholder:text-fg-neutral-secondary disabled:opacity-50"
    />
  );
}

/* Row is click-through so the textarea stays clickable beneath it in the
   single-line state; only the controls themselves catch clicks. */
function ComposerControls(
  { multiline, controlsRef, send, sendDisabled }: {
    multiline: boolean;
    controlsRef: React.RefObject<HTMLDivElement | null>;
    send: () => Promise<void> | void;
    sendDisabled: boolean;
  },
) {
  return (
    <div
      className={`pointer-events-none flex justify-end transition-[margin] duration-200 ease-out ${
        multiline ? "mt-1.5" : "-mt-9"
      }`}
    >
      <div
        ref={controlsRef}
        className="pointer-events-auto flex items-center"
      >
        <ModelSelector />
        <button
          type="button"
          onClick={() => {
            void send();
          }}
          disabled={sendDisabled}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-neutral-100 disabled:opacity-35"
          aria-label="Send"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
