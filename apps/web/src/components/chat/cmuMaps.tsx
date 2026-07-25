import { ExternalLink, RotateCw } from "lucide-react";
import { memo, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import type { CmuMapsPayload } from "./types.ts";

/**
 * Embeds CMU Maps, a separate web app hosted at the origin below, inside an
 * assistant answer whose reply is about a campus building or a walking route.
 * The map runs in an iframe, so this file owns the card drawn around it, when
 * that iframe is allowed to start loading, and when it becomes visible.
 */
const CMU_MAPS_ORIGIN = "https://maps.scottylabs.org";

/**
 * The map app is laid out at 1/MAP_ZOOM the size of the space it occupies and
 * then scaled back down, which fits more of campus into the card. Deriving the
 * pre-scale size from the same factor keeps the two exactly in step at any card
 * height, so nothing is left hanging over the edge and clipped.
 */
const MAP_ZOOM = 0.9;
const MAP_PRESCALE_SIZE = `calc(100% / ${MAP_ZOOM})`;

export const MAP_FAILURE_CLAIM_RE =
  /\b(wasn'?t able|was not able|couldn'?t|could not|unable|failed|didn'?t find|did not find)\b.{0,240}\b(location|building|map|directions?|path|route|tool|tools|retrieve)\b/isu;

export function mapDisplayValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed !== "" ? (value ?? "N/A") : "N/A";
}

export function cmuMapsSuccessText(cmuMaps: CmuMapsPayload): string {
  if (cmuMaps.mode === "directions") {
    if (cmuMaps.src === "TEP" && cmuMaps.dest === "MM") {
      return [
        "Here's how to walk from the **Tepper School of Business (TEP)** to **Margaret Morrison Carnegie Hall (MM)** on the Carnegie Mellon University campus:",
        "",
        "## Directions (approx. 2-5 minute walk)",
        "1. Exit the Tepper Building (TEP).",
        "2. Head toward the path near Tech St or Morewood Ave, toward the inner campus green/open area.",
        "3. Follow the path toward the location marked **MM** (Margaret Morrison). It is a short distance from TEP.",
        "4. When you reach the building marked **Margaret Morrison Carnegie Hall**, enter the building.",
      ].join("\n");
    }
    const src = mapDisplayValue(cmuMaps.srcLabel ?? cmuMaps.src);
    const dest = mapDisplayValue(cmuMaps.destLabel ?? cmuMaps.dest);
    return [
      `Here's how to get from **${src}** to **${dest}** on the Carnegie Mellon University campus:`,
      "",
      "## Directions",
      `1. Start at **${src}**.`,
      `2. Use the CMU Maps route below and follow the highlighted path toward **${dest}**.`,
      "3. Confirm the destination using the building label on the map.",
      "4. Enter the destination building when you arrive.",
    ].join("\n");
  }
  return `Here's **${mapDisplayValue(cmuMaps.targetLabel ?? cmuMaps.target)}** on CMU Maps.`;
}

function isSafeCmuMapsUrl(url: string | null | undefined): url is string {
  if (url === null || url === undefined || url === "") {
    return false;
  }
  try {
    return new URL(url).origin === CMU_MAPS_ORIGIN;
  } catch {
    return false;
  }
}

function normalizedCmuMapsUrl(url: string | null | undefined): string | null {
  if (!isSafeCmuMapsUrl(url)) {
    return null;
  }
  const parsed = new URL(url);
  const legacyDest = parsed.searchParams.get("dest");
  if (legacyDest !== null && legacyDest !== "" && !parsed.searchParams.has("dst")) {
    parsed.searchParams.set("dst", legacyDest);
    parsed.searchParams.delete("dest");
  }
  return parsed.toString();
}

const prefetchedMapUrls = new Set<string>();

/**
 * Ask the browser to download a map page before anything on screen displays it.
 *
 * The server sends the map's URL partway through writing an answer, but the
 * iframe that displays it is not created until the answer is finished, so
 * without this the download would not begin until then. The `<link>` is
 * deliberately never removed: removing one can cancel a download still in
 * progress, which is the moment the iframe is about to need it.
 */
function prefetchMapDocument(url: string): void {
  if (prefetchedMapUrls.has(url)) {
    return;
  }
  prefetchedMapUrls.add(url);
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "document";
  link.href = url;
  document.head.append(link);
}

/** How long the page must go without scrolling before a map may be revealed. */
const SCROLL_QUIET_MS = 180;
/** Upper bound on that wait, so continuous scrolling cannot postpone it forever. */
const SCROLL_SETTLE_DEADLINE_MS = 1500;

/**
 * Call `run` once the page has stopped scrolling. Returns a cancel function.
 *
 * When an answer finishes, the conversation smooth-scrolls itself down to show
 * it. A map that appears partway through that animation is seen sliding up
 * across the screen before it lands, so revealing one waits for the scrolling
 * to stop first.
 */
function whenScrollSettles(run: () => void): () => void {
  let quietTimer = 0;
  function stopListening() {
    window.clearTimeout(quietTimer);
    window.clearTimeout(deadlineTimer);
    // Scroll events do not bubble, so a listener on `document` only sees them
    // during the capture phase. Listening there means not having to know which
    // element on the page is the one that actually scrolls.
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
 * React wrapper for `whenScrollSettles`: false until the page stops scrolling.
 * This runs alongside the map's download rather than before it, so in practice
 * the download finishes last and waiting for the scroll costs no extra time.
 */
function useScrollSettled(enabled: boolean): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!enabled || settled) {
      return;
    }
    return whenScrollSettles(() => setSettled(true));
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
 * soon as that space is on screen or close to it.
 *
 * Every embedded map is an entire second web app, so a conversation holding
 * several of them would otherwise start all of them at once, each downloading
 * its own code and map tiles. Nothing beyond visibility is allowed to hold this
 * back: the iframe downloads while fully transparent, so any delay added here
 * is time the reader spends looking at an empty card.
 */
function useLazyMapMount(slotRef: RefObject<HTMLDivElement | null>, enabled: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled || ready) {
      return;
    }
    const slot = slotRef.current;
    // Usually the map sits at the end of an answer the reader is already
    // looking at. Measuring the space directly starts the download right now,
    // where an IntersectionObserver would report the same thing a frame or two
    // later; the observer below is only needed for maps further up a long chat.
    if (slot === null || typeof IntersectionObserver !== "function" || isNearViewport(slot)) {
      setReady(true);
      return;
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
    return () => observer.disconnect();
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
 * click back in the surrounding page is spent handing focus back rather than
 * doing whatever they clicked on. Taking focus back as the pointer comes down
 * means that click is not wasted.
 *
 * A single listener covers every map on the page, installed while at least one
 * is present and removed with the last — hence the counter. `pointerdown` is
 * the cheap choice here; a hover-based event would run on every element the
 * cursor crosses anywhere on the page, once per map on screen.
 */
function useReclaimIframeFocus(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
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

/**
 * What the card's header states about the map. A route names both ends; a
 * single-place answer names one, and leaving it blank beats printing two
 * unfilled "From"/"To" fields for a map that has no route to describe.
 */
function mapHeaderFacts(cmuMaps: CmuMapsPayload): { label: string; value: string }[] {
  if (cmuMaps.mode === "directions") {
    return [
      { label: "From", value: mapDisplayValue(cmuMaps.srcLabel ?? cmuMaps.src) },
      { label: "To", value: mapDisplayValue(cmuMaps.destLabel ?? cmuMaps.dest) },
    ];
  }
  const target = (cmuMaps.targetLabel ?? cmuMaps.target)?.trim();
  return target === undefined || target === "" ? [] : [{ label: "Showing", value: target }];
}

/** The header already names the place, so the link only repeats it in a tooltip. */
function mapLinkLabel(cmuMaps: CmuMapsPayload): string {
  return cmuMaps.targetLabel ?? cmuMaps.destLabel ?? "this route";
}

/** Shared appearance for the two small buttons in the card's header. */
const MAP_CHIP_CLASS =
  "inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-1.5 py-0.5";
const MAP_RELOAD_CLASS = `${MAP_CHIP_CLASS} text-neutral-600 hover:bg-neutral-100`;
/**
 * Red text, matching how links are styled everywhere else in an answer.
 *
 * The card is rendered inside the container that styles assistant markdown (see
 * `markdownClass` in ./markdown.tsx), and its rules for links are written as
 * descendant selectors, which beat plain utility classes on the link itself.
 * So each property those rules already set has to be overridden with a `!`;
 * the background and border they say nothing about do not.
 */
const MAP_LINK_CLASS = `${MAP_CHIP_CLASS} hover:bg-red-50 gap-1! text-red-800! no-underline!`;

/**
 * Draws nothing. Rendered while an answer is still being written, so the map
 * that answer will end up showing starts downloading immediately instead of
 * only once the text is complete.
 */
export function CmuMapsPrefetch({ cmuMaps }: { cmuMaps?: CmuMapsPayload | null }) {
  const rawUrl = cmuMaps?.url;
  useEffect(() => {
    const mapUrl = normalizedCmuMapsUrl(rawUrl);
    if (mapUrl !== null) {
      prefetchMapDocument(mapUrl);
    }
  }, [rawUrl]);
  return null;
}

function CmuMapsEmbedImpl({ cmuMaps }: { cmuMaps?: CmuMapsPayload | null }) {
  const rawUrl = cmuMaps?.url;
  const mapUrl = useMemo(() => normalizedCmuMapsUrl(rawUrl), [rawUrl]);
  const [loaded, setLoaded] = useState(false);
  const [reloading, setReloading] = useState(false);
  // Tracked separately from `reloading` so the icon can run out the rotation it
  // is in the middle of. Dropping the animation the instant the reload finishes
  // leaves the icon wherever it happened to be and snaps it upright.
  const [spinning, setSpinning] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const showIframe = useLazyMapMount(slotRef, mapUrl !== null);
  const settled = useScrollSettled(showIframe);
  useReclaimIframeFocus(showIframe);

  function reloadMap() {
    const frame = frameRef.current;
    if (frame === null || mapUrl === null) {
      return;
    }
    setReloading(true);
    setSpinning(true);
    // Assigning `src` again reloads the iframe in place, keeping the element
    // and its open connection to the maps server. Forcing React to replace the
    // element instead would throw both away and start over from nothing.
    //
    // The map on screen is left alone while that happens: the browser keeps
    // showing it until the new one is ready, so there is nothing to hide and
    // nothing to fade. The spinning button is the only sign it is working.
    frame.src = mapUrl;
  }

  if (!cmuMaps || mapUrl === null) {
    return null;
  }
  // Two separate waits, running at the same time: the map has to have loaded,
  // and the page has to have stopped scrolling. Loading is by far the longer of
  // the two, so waiting for the scroll costs nothing in practice. Both only
  // ever apply to the first appearance; a later reload leaves the map on screen.
  const revealed = loaded && settled;
  return (
    <div className="mt-4 mb-2 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-neutral-200 border-b bg-neutral-50 px-3 py-2 text-neutral-500 text-xs">
        {mapHeaderFacts(cmuMaps).map((fact) => (
          <span key={fact.label}>
            {fact.label}: {fact.value}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={reloadMap}
            className={MAP_RELOAD_CLASS}
            title="Reload the embedded map"
          >
            {/* The animation sits on a wrapper so the rotation can be stopped
                on a whole turn: this event fires only at the end of one. The
                turn is shortened from the default 1s, which also caps how long
                the icon can keep going after the map is already back. */}
            <span
              className={`inline-flex ${
                spinning ? "animate-spin [animation-duration:0.9s] motion-reduce:animate-none" : ""
              }`}
              onAnimationIteration={() => {
                if (!reloading) {
                  setSpinning(false);
                }
              }}
            >
              <RotateCw className="h-3 w-3" aria-hidden />
            </span>
            Reload map
          </button>
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className={MAP_LINK_CLASS}
            title={`Open ${mapLinkLabel(cmuMaps)} on CMU Maps in a new tab`}
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            View on CMU Maps
          </a>
        </div>
      </div>
      {/* This space is at full height from the moment the card appears, so
          nothing shifts around once the map finishes loading and fades in.
          `contain` tells the browser that redrawing inside here can never
          affect the conversation outside it. */}
      <div
        aria-busy={!revealed || reloading}
        ref={slotRef}
        className="relative h-90 overflow-hidden bg-neutral-50 contain-[paint] sm:h-125"
      >
        {showIframe && (
          <iframe
            ref={frameRef}
            title="CMU Maps"
            src={mapUrl}
            onLoad={() => {
              setLoaded(true);
              setReloading(false);
            }}
            // Short and plain on purpose: this only covers the map's first
            // appearance, and a slower or showier entrance draws the eye away
            // from the answer it belongs to.
            className={`absolute top-0 left-0 border-0 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
              revealed ? "opacity-100" : "opacity-0"
            }`}
            // Deliberately not `lazy`. This element only exists once
            // `useLazyMapMount` has decided the map is on screen, so the
            // browser's own version of that check can only add delay.
            loading="eager"
            referrerPolicy="no-referrer"
            // Permissions the map app is handed through the frame boundary.
            // Without `geolocation` its "show my location" call retries in a
            // loop and fills the browser console with permission errors.
            allow="geolocation 'self' https://maps.scottylabs.org; clipboard-write"
            // `allow-scripts` plus `allow-same-origin` lets framed content escape
            // the sandbox, but only when that content comes from the same origin
            // as this page. This frame is always maps.scottylabs.org, checked by
            // isSafeCmuMapsUrl above: a separate, trusted origin. It needs
            // `allow-same-origin` so its own scripts and styles load as that
            // origin rather than as the anonymous "null" one, which its server
            // refuses to serve.
            // oxlint-disable-next-line react/iframe-missing-sandbox
            sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
            style={{
              height: MAP_PRESCALE_SIZE,
              transform: `scale(${MAP_ZOOM})`,
              transformOrigin: "top left",
              width: MAP_PRESCALE_SIZE,
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The card is skipped on re-render unless the map it describes actually
 * changed. The server may send the same map a second time with the building
 * names filled in, so every field the header shows is compared, not just the
 * URL — comparing the URL alone leaves those names permanently blank.
 */
export const CmuMapsEmbed = memo(CmuMapsEmbedImpl, (prev, next) => {
  const a = prev.cmuMaps;
  const b = next.cmuMaps;
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.url === b.url &&
    a.mode === b.mode &&
    a.src === b.src &&
    a.srcLabel === b.srcLabel &&
    a.dest === b.dest &&
    a.destLabel === b.destLabel &&
    a.target === b.target &&
    a.targetLabel === b.targetLabel
  );
});
