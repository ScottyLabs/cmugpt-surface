/**
 * Card that embeds CMU Maps inside an assistant answer. The map is a separate
 * web app in an iframe. This file owns the surrounding frame and its reveal
 * timing.
 */
import { memo, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { MapHeader } from "./cmuMapsHeader.tsx";
import { useLazyMapMount, useReclaimIframeFocus, useScrollSettled } from "./cmuMapsLoading.ts";
import { CMU_MAPS_ORIGIN, normalizedCmuMapsUrl, prefetchMapDocument } from "./cmuMapsUrl.ts";
import type { CmuMapsPayload } from "./types.ts";

// Re-exported so markdown.tsx keeps its existing text helper import path.
export { cmuMapsSuccessText, MAP_FAILURE_CLAIM_RE } from "./cmuMapsText.ts";

/**
 * The map is laid out at 1/MAP_ZOOM of its slot and scaled back down, fitting
 * more of the campus into the card. Deriving both values from one factor
 * prevents clipping at any card height.
 */
const MAP_ZOOM = 0.9;
const MAP_PRESCALE_SIZE = `calc(100% / ${MAP_ZOOM})`;

/**
 * Renders nothing. Mounted while the answer streams so the upcoming map starts
 * downloading before the iframe exists.
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
 * allow-scripts with allow-same-origin can escape the sandbox only for
 * same-origin content, and this frame is always the CMU Maps origin,
 * enforced by normalizedCmuMapsUrl. allow-same-origin is required for its
 * assets to load as that origin rather than null, which its server rejects.
 * The geolocation grant prevents its location lookup from retrying in a loop.
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
      // Covers only the first appearance. A stronger entrance would draw
      // attention away from the answer.
      className={`absolute top-0 left-0 border-0 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
        revealed ? "opacity-100" : "opacity-0"
      }`}
      // Not lazy. useLazyMapMount has already decided the map is near the
      // viewport, so a browser recheck only adds delay.
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
 * The slot the map occupies. Full height from first paint so the fade-in
 * causes no layout shift. The contain property isolates repaints from the
 * surrounding conversation.
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
  // True while a load this card requested is pending. The frame also fires
  // load for its own navigations, whose cross-origin URL cannot be read, so
  // this flag is what distinguishes the two. Assigning src is the only way
  // the card requests a load, and it cancels any load in flight, so a single
  // flag suffices. Unlike a counter, it also survives StrictMode running the
  // effect twice.
  const owedLoad = useRef(false);
  useEffect(() => {
    owedLoad.current = true;
  }, [mapUrl]);

  function reloadMap() {
    const frame = frameRef.current;
    if (frame === null || mapUrl === null) {
      return;
    }
    setReloading(true);
    owedLoad.current = true;
    // Reassigning src reloads the frame in place. The old page stays visible
    // until the new one is ready.
    frame.src = mapUrl;
  }

  function handleFrameLoad() {
    if (owedLoad.current) {
      owedLoad.current = false;
      setLoaded(true);
      setReloading(false);
      return;
    }
    // The frame navigated to a page this card cannot show. The in-map sign-in
    // does this, since its identity provider refuses framing and strands the
    // frame on an error page or the API root. Hide the stray page and restore
    // the map. The restore cannot loop, because the card requests its load.
    setLoaded(false);
    reloadMap();
  }

  if (!cmuMaps || mapUrl === null) {
    return null;
  }
  // Reveal waits for both the load and the scroll to settle. The load
  // dominates, so the scroll wait adds no perceptible delay. Both gates apply
  // only to the first appearance, since a reload keeps the map on screen.
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
            onLoad={handleFrameLoad}
          />
        )}
      </MapSlot>
    </div>
  );
}

/**
 * Re-renders only when the map payload changed. The server may resend the
 * same URL with the labels filled in, so every header field is compared, not
 * the URL alone.
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
