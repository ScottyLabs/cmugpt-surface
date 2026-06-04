import { ExternalLink } from "lucide-react";
import { memo } from "react";
import type { CmuMapsPayload } from "@/lib/chatUtils.ts";
import { CMU_MAPS_ORIGIN, mapDisplayValue } from "@/lib/chatUtils.ts";

function isSafeCmuMapsUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    return new URL(url).origin === CMU_MAPS_ORIGIN;
  } catch {
    return false;
  }
}

export function normalizedCmuMapsUrl(
  url: string | null | undefined,
): string | null {
  if (!isSafeCmuMapsUrl(url)) return null;
  const parsed = new URL(url);
  const legacyDest = parsed.searchParams.get("dest");
  if (legacyDest && !parsed.searchParams.has("dst")) {
    parsed.searchParams.set("dst", legacyDest);
    parsed.searchParams.delete("dest");
  }
  return parsed.toString();
}

function CmuMapsEmbedImpl({ cmuMaps }: { cmuMaps?: CmuMapsPayload | null }) {
  const mapUrl = normalizedCmuMapsUrl(cmuMaps?.url);
  if (!cmuMaps || !mapUrl) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-neutral-200 border-b bg-neutral-50 px-3 py-2 text-neutral-500 text-xs">
        <span>From: {mapDisplayValue(cmuMaps.srcLabel ?? cmuMaps.src)}</span>
        <span>To: {mapDisplayValue(cmuMaps.destLabel ?? cmuMaps.dest)}</span>
      </div>
      <div className="h-[500px] overflow-hidden">
        <iframe
          key={mapUrl}
          title="CMU Maps"
          src={mapUrl}
          className="border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
          allow="geolocation 'self' https://maps.scottylabs.org; clipboard-write"
          sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
          style={{
            height: "556px",
            transform: "scale(0.9)",
            transformOrigin: "top left",
            width: "111.111%",
          }}
        />
      </div>
    </div>
  );
}

export const CmuMapsEmbed = memo(CmuMapsEmbedImpl, (prev, next) => {
  return (
    normalizedCmuMapsUrl(prev.cmuMaps?.url) ===
    normalizedCmuMapsUrl(next.cmuMaps?.url)
  );
});

export function CmuMapsLink({ cmuMaps }: { cmuMaps?: CmuMapsPayload | null }) {
  const mapUrl = normalizedCmuMapsUrl(cmuMaps?.url);
  if (!cmuMaps || !mapUrl) return null;
  const label = cmuMaps.targetLabel ?? cmuMaps.destLabel ?? "CMU Maps";
  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-neutral-700 text-xs hover:border-neutral-300 hover:bg-neutral-100"
    >
      <ExternalLink className="h-3 w-3" aria-hidden={true} />
      View on CMU Maps: {label}
    </a>
  );
}
