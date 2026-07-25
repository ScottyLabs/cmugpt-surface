import { ExternalLink, RotateCw } from "lucide-react";
import { memo, useEffect, useState } from "react";
import type { CmuMapsPayload } from "./types.ts";

const CMU_MAPS_ORIGIN = "https://maps.scottylabs.org";

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

/**
 * Delay loading the heavier map application until the conversation has
 * rendered, while still mounting it within the message that owns the route.
 */
function useDeferredMount(enabled: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled || ready) {
      return;
    }
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setReady(true), {
        timeout: 1200,
      });
      return () => window.cancelIdleCallback(id);
    }
    const timeout = window.setTimeout(() => setReady(true), 200);
    return () => window.clearTimeout(timeout);
  }, [enabled, ready]);
  return ready;
}

function CmuMapsEmbedImpl({ cmuMaps }: { cmuMaps?: CmuMapsPayload | null }) {
  const mapUrl = normalizedCmuMapsUrl(cmuMaps?.url);
  const [reloadNonce, setReloadNonce] = useState(0);
  const showIframe = useDeferredMount(mapUrl !== null);

  // Clicking outside an interacted-with iframe should activate the surrounding
  // app immediately instead of spending the first click only reclaiming focus.
  useEffect(() => {
    if (!showIframe) {
      return;
    }
    function reclaimFocus() {
      const active = document.activeElement;
      if (active instanceof HTMLIFrameElement) {
        active.blur();
        window.focus();
      }
    }
    document.addEventListener("pointerover", reclaimFocus);
    return () => document.removeEventListener("pointerover", reclaimFocus);
  }, [showIframe]);

  if (!cmuMaps || mapUrl === null) {
    return null;
  }
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-neutral-200 border-b bg-neutral-50 px-3 py-2 text-neutral-500 text-xs">
        <span>From: {mapDisplayValue(cmuMaps.srcLabel ?? cmuMaps.src)}</span>
        <span>To: {mapDisplayValue(cmuMaps.destLabel ?? cmuMaps.dest)}</span>
        <button
          type="button"
          onClick={() => setReloadNonce((nonce) => nonce + 1)}
          className="ml-auto inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-neutral-600 hover:bg-neutral-100"
          title="Reload the embedded map"
        >
          <RotateCw className="h-3 w-3" aria-hidden />
          Reload map
        </button>
      </div>
      <div className="h-[500px] overflow-hidden bg-neutral-50">
        {showIframe ? (
          <iframe
            key={`${mapUrl}#r${reloadNonce}`}
            title="CMU Maps"
            src={mapUrl}
            className="border-0"
            loading="lazy"
            referrerPolicy="no-referrer"
            // Grant Permissions Policy delegations the maps app uses.
            // Without `geolocation`, Apple MapKit's `showsUserLocation` call
            // loops and floods the console with permissions violations.
            allow="geolocation 'self' https://maps.scottylabs.org; clipboard-write"
            // allow-scripts + allow-same-origin together is only a sandbox-escape risk when the
            // framed content shares the parent's origin. This iframe is always
            // https://maps.scottylabs.org (enforced by isSafeCmuMapsUrl above), a different,
            // trusted first-party origin, and needs allow-same-origin so its own bundled JS/CSS
            // load under its real origin instead of an opaque "null" origin that its CORS policy
            // rejects.
            // oxlint-disable-next-line react/iframe-missing-sandbox
            sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
            style={{
              height: "556px",
              transform: "scale(0.9)",
              transformOrigin: "top left",
              width: "111.111%",
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-400 text-xs">
            Loading map…
          </div>
        )}
      </div>
    </div>
  );
}

export const CmuMapsEmbed = memo(CmuMapsEmbedImpl, (prev, next) => {
  // Only re-render when the rendered URL actually changes. Other field
  // changes (labels, etc.) are cosmetic and shouldn't trigger an iframe
  // reflow.
  return normalizedCmuMapsUrl(prev.cmuMaps?.url) === normalizedCmuMapsUrl(next.cmuMaps?.url);
});

export function CmuMapsLink({ cmuMaps }: { cmuMaps?: CmuMapsPayload | null }) {
  const mapUrl = normalizedCmuMapsUrl(cmuMaps?.url);
  if (!cmuMaps || mapUrl === null) {
    return null;
  }
  const label = cmuMaps.targetLabel ?? cmuMaps.destLabel ?? "CMU Maps";
  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-neutral-700 text-xs hover:border-neutral-300 hover:bg-neutral-100"
    >
      <ExternalLink className="h-3 w-3" aria-hidden />
      View on CMU Maps: {label}
    </a>
  );
}
