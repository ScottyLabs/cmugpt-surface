/**
 * The card that shows a CMU Maps route inside an assistant answer. The map is a
 * separate web app running in an iframe (see ./cmuMapsUrl.ts); what lives here
 * is the frame drawn around it and when it becomes visible.
 */
import { memo, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { MapHeader } from "./cmuMapsHeader.tsx";
import { useLazyMapMount, useReclaimIframeFocus, useScrollSettled } from "./cmuMapsLoading.ts";
import { CMU_MAPS_ORIGIN, normalizedCmuMapsUrl, prefetchMapDocument } from "./cmuMapsUrl.ts";
import type { CmuMapsPayload } from "./types.ts";

// Re-exported so ./markdown.tsx keeps importing the answer-text helpers from
// here, rather than every caller having to know they moved.
export { cmuMapsSuccessText, MAP_FAILURE_CLAIM_RE } from "./cmuMapsText.ts";

/**
 * The map app is laid out at 1/MAP_ZOOM the size of the space it occupies and
 * scaled back down, fitting more of campus into the card. Deriving the
 * pre-scale size from the same factor keeps the two in step at any card height,
 * so nothing hangs over the edge and gets clipped.
 */
const MAP_ZOOM = 0.9;
const MAP_PRESCALE_SIZE = `calc(100% / ${MAP_ZOOM})`;

/**
 * Draws nothing. Rendered while an answer is still being written so the map it
 * will end up showing starts downloading now, not once the text is complete.
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

/**
 * The embedded map app.
 *
 * `allow-scripts` plus `allow-same-origin` lets framed content escape the
 * sandbox, but only when that content shares this page's origin. This frame is
 * always CMU Maps, checked by `normalizedCmuMapsUrl`: a separate, trusted
 * origin. It needs `allow-same-origin` so its own scripts and styles load as
 * that origin rather than the anonymous "null" one, which its server refuses to
 * serve. Without `geolocation`, its "show my location" call retries in a loop
 * and fills the console with permission errors.
 */
function MapFrame({
  frameRef,
  mapUrl,
  onLoad,
  revealed,
}: {
  frameRef: RefObject<HTMLIFrameElement | null>;
  mapUrl: string;
  onLoad: () => void;
  revealed: boolean;
}) {
  return (
    <iframe
      ref={frameRef}
      title="CMU Maps"
      src={mapUrl}
      onLoad={onLoad}
      // Short and plain on purpose: this covers only the map's first
      // appearance, and a showier entrance pulls the eye off the answer.
      className={`absolute top-0 left-0 border-0 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
        revealed ? "opacity-100" : "opacity-0"
      }`}
      // Deliberately not `lazy`. This element exists only once `useLazyMapMount`
      // has decided the map is on screen, so the browser repeating that check
      // can only add delay.
      loading="eager"
      referrerPolicy="no-referrer"
      allow={`geolocation 'self' ${CMU_MAPS_ORIGIN}; clipboard-write`}
      // oxlint-disable-next-line react/iframe-missing-sandbox
      sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
      style={{
        height: MAP_PRESCALE_SIZE,
        transform: `scale(${MAP_ZOOM})`,
        transformOrigin: "top left",
        width: MAP_PRESCALE_SIZE,
      }}
    />
  );
}

/**
 * The space the map occupies. It is at full height from the moment the card
 * appears, so nothing shifts when the map fades in, and `contain` tells the
 * browser that redrawing in here can never affect the conversation outside it.
 */
function MapSlot({
  busy,
  children,
  slotRef,
}: {
  busy: boolean;
  children: ReactNode;
  slotRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      aria-busy={busy}
      ref={slotRef}
      className="relative h-90 overflow-hidden bg-neutral-50 contain-[paint] sm:h-125"
    >
      {children}
    </div>
  );
}

function CmuMapsEmbedImpl({ cmuMaps }: { cmuMaps?: CmuMapsPayload | null }) {
  const rawUrl = cmuMaps?.url;
  const mapUrl = useMemo(() => normalizedCmuMapsUrl(rawUrl), [rawUrl]);
  const [loaded, setLoaded] = useState(false);
  const [reloading, setReloading] = useState(false);
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
    // Reassigning `src` reloads the frame in place, keeping the element and its
    // open connection. The map stays on screen while that happens, since the
    // browser shows the old one until the new one is ready.
    frame.src = mapUrl;
  }

  if (!cmuMaps || mapUrl === null) {
    return null;
  }
  // Two waits at once: the map has to have loaded and the page has to have
  // stopped scrolling. Loading is much the longer, so the scroll costs nothing.
  // Both apply only to the first appearance; a reload leaves the map on screen.
  const revealed = loaded && settled;
  return (
    <div className="mt-4 mb-2 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <MapHeader cmuMaps={cmuMaps} mapUrl={mapUrl} reloading={reloading} onReload={reloadMap} />
      <MapSlot busy={!revealed || reloading} slotRef={slotRef}>
        {showIframe && (
          <MapFrame
            frameRef={frameRef}
            mapUrl={mapUrl}
            revealed={revealed}
            onLoad={() => {
              setLoaded(true);
              setReloading(false);
            }}
          />
        )}
      </MapSlot>
    </div>
  );
}

/**
 * The card re-renders only when the map it describes actually changed. The
 * server may send the same map a second time with the building names filled
 * in, so every field the header shows is compared, not just the URL. Comparing
 * the URL alone leaves those names permanently blank.
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
