import { type RefObject, useEffect, useState } from "react";

/**
 * No op cleanup for effect paths that set nothing up, keeping every path
 * returning a function as the lint rules require.
 */
function noCleanup(): void {
  // Nothing to clean up.
}

/** How long the page must go without scrolling before a map may be revealed. */
const SCROLL_QUIET_MS = 180;
/** Upper bound on that wait, so continuous scrolling cannot postpone it forever. */
const SCROLL_SETTLE_DEADLINE_MS = 1500;

/**
 * Calls run once scrolling stops and returns a cancel function. Revealing a
 * map mid scroll would show it sliding across the screen.
 */
function whenScrollSettles(run: () => void): () => void {
  let quietTimer = 0;
  function stopListening() {
    window.clearTimeout(quietTimer);
    window.clearTimeout(deadlineTimer);
    // Scroll events do not bubble, so the document listener uses the capture
    // phase and need not know which element scrolls.
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
 * False until scrolling settles. Runs concurrently with the map download,
 * which takes longer, so this wait is free.
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
 * False until the slot is on or near the viewport, which is when the map may
 * start loading. Each embed is a full web app, so this keeps a long
 * conversation from starting every map at once. Visibility is the only gate
 * because the iframe downloads while transparent.
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
    // Most maps mount already on screen. A direct measurement starts the
    // download immediately, the observer covers maps scrolled out of view.
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
 * A click inside an iframe leaves it holding keyboard focus, and the next
 * click back in the page is spent returning focus. Reclaiming focus on
 * pointerdown saves that click. One shared listener serves every map, the
 * counter installs it with the first and removes it with the last. pointerdown
 * is cheap where hover events would fire per element crossed.
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
