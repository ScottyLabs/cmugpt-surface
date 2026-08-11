import type { ChatShellController } from "../useChatShell.ts";
import { Composer } from "./Composer.tsx";

/**
 * Floats over the bottom of the conversation rather than sitting below it in
 * flow. Everything around the pill is transparent and click-through, so
 * scrolling messages stay visible right up until they slide behind the pill
 * itself and vanish at its rounded corners.
 */
export function ComposerFooter({ c }: { c: ChatShellController }) {
  const { derived, session, stream } = c;
  // The centered new-chat screen renders its own composer, so the footer
  // composer only appears once a conversation is active.
  const showFooterComposer = derived.shouldShowConversation ||
    session.chatsLoading;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
      {showFooterComposer && (
        <>
          <div className="relative z-10 px-4 pt-3">
            <div className="pointer-events-auto mx-auto w-full max-w-[48.25rem]">
              <Composer c={c} />
            </div>
          </div>
          {
            /* Opaque strip under the pill: tucked one corner-radius up behind
              it (the pill paints on top) so scrolling text is fully gone by
              the pill's bottom edge, with nothing showing through the corner
              notches or around the disclaimer. */
          }
          <div className="-mt-7 bg-white px-4 pb-4 pt-7">
            <p className="text-xs text-center font-medium text-fg-neutral-tertiary pt-3">
              CMUGPT is AI and can make mistakes. Please double-check responses.
            </p>
            {stream.streamError !== null && stream.streamError !== "" && (
              <p className="mx-auto mt-2 max-w-3xl text-center text-red-600 text-xs">
                {stream.streamError}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
