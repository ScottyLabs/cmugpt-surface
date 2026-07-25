import { type RefObject, useEffect, useState } from "react";

/**
 * Cleanup for effect paths that set nothing up. Effects here return their real
 * cleanup on the main path, and returning this from the others keeps every
 * path returning a function, which the lint rules require over a bare return.
 */
function noCleanup(): void {
  // Nothing to clean up.
}

/** How long the page must go without scrolling before a map may be revealed. */
const SCROLL_QUIET_MS = 180;
/** Upper bound on that wait, so continuous scrolling cannot postpone it forever. */
const SCROLL_SETTLE_DEADLINE_MS = 1500;

/**
 * Call `run` once the page has stopped scrolling. Returns a cancel function.
 * Finishing an answer smooth-scrolls the conversation down to show it, and a
 * map revealed partway through that animation is seen sliding up across the
 * screen before it lands.
 */
function whenScrollSettles(run: () => void): () => void {
  let quietTimer = 0;
  function stopListening() {
    window.clearTimeout(quietTimer);
    window.clearTimeout(deadlineTimer);
    // Scroll events do not bubble, so a listener on `document` only sees them
    // during the capture phase. That saves having to know which element scrolls.
    document.removeEventListener("scroll", restartQuietTimer, { capture: true });
  }
  function settle() {
    stopListening();
    run();
  }
  function restartQuietTimer() {
    window.clearTimeout(quietTimer);
    quietTimer = window.setTimeout(settle, SCROLL_QUIET_MS);
  }
  const deadlineTimer = window.setTimeout(settle, SCROLL_SETTLE_DEADLINE_MS);
  document.addEventListener("scroll", restartQuietTimer, { capture: true, passive: true });
  restartQuietTimer();
  return stopListening;
}

/**
 * False until the page stops scrolling. Runs alongside the map's download
 * rather than before it, so the download finishes last and this costs nothing.
 */
export function useScrollSettled(enabled: boolean): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!enabled || settled) {
      return noCleanup;
    }
    return whenScrollSettles(() => {
      setSettled(true);
    });
  }, [enabled, settled]);
  return settled;
}

/** How far off screen a map may still be and be allowed to start loading. */
const MAP_PRELOAD_MARGIN_PX = 400;

function isNearViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.bottom > -MAP_PRELOAD_MARGIN_PX && rect.top < window.innerHeight + MAP_PRELOAD_MARGIN_PX
  );
}

/**
 * False until the map belonging to `slotRef` may start loading, which is as
 * soon as that space is on screen or close to it. Every embedded map is an
 * entire second web app, so a conversation holding several would otherwise
 * start them all at once. Nothing beyond visibility holds this back: the iframe
 * downloads while fully transparent, so delay here is time spent staring at an
 * empty card.
 */
export function useLazyMapMount(
  slotRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled || ready) {
      return noCleanup;
    }
    const slot = slotRef.current;
    // Usually the map sits at the end of an answer already on screen. Measuring
    // directly starts the download now, where an IntersectionObserver reports
    // the same thing a frame or two later; the observer is for maps further up.
    if (slot === null || typeof IntersectionObserver !== "function" || isNearViewport(slot)) {
      setReady(true);
      return noCleanup;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setReady(true);
        }
      },
      { rootMargin: `${MAP_PRELOAD_MARGIN_PX}px 0px` },
    );
    observer.observe(slot);
    return () => {
      observer.disconnect();
    };
  }, [enabled, ready, slotRef]);
  return ready;
}

function reclaimFocusFromIframe() {
  const active = document.activeElement;
  if (active instanceof HTMLIFrameElement) {
    active.blur();
    window.focus();
  }
}

let focusReclaimCount = 0;

/**
 * Once someone clicks inside an iframe it holds keyboard focus, and their next
 * click back in the page is spent handing focus back rather than doing what
 * they clicked. Taking focus back as the pointer comes down saves that click.
 *
 * One listener covers every map on the page, installed while at least one is
 * present and removed with the last, which is what the counter tracks.
 * `pointerdown` is the cheap choice: a hover event would run on every element
 * the cursor crosses anywhere on the page, once per map on screen.
 */
export function useReclaimIframeFocus(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return noCleanup;
    }
    focusReclaimCount += 1;
    if (focusReclaimCount === 1) {
      document.addEventListener("pointerdown", reclaimFocusFromIframe, {
        capture: true,
        passive: true,
      });
    }
    return () => {
      focusReclaimCount -= 1;
      if (focusReclaimCount === 0) {
        document.removeEventListener("pointerdown", reclaimFocusFromIframe, { capture: true });
      }
    };
  }, [enabled]);
}
