/** Toolbar strip at the top of a CMU Maps card, with reload and open in new
 *  tab actions. */
import { ExternalLink, RotateCw } from "lucide-react";
import { useState } from "react";
import { mapDisplayValue } from "./cmuMapsText.ts";
import type { CmuMapsPayload } from "./types.ts";

/** Shared appearance for the small header buttons. */
const MAP_CHIP_CLASS =
  "inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-1.5 py-0.5";
const MAP_RELOAD_CLASS = `${MAP_CHIP_CLASS} text-neutral-600 hover:bg-neutral-100`;
/**
 * Red link text matching answer links. The markdown container styles links
 * with descendant selectors that beat plain utilities, so each property they
 * set needs an important marker. Background and border need none.
 */
const MAP_LINK_CLASS = `${MAP_CHIP_CLASS} hover:bg-red-50 gap-1! text-red-800! no-underline!`;

/**
 * Facts the header states. A route names both ends, a single place answer
 * names one, and an empty payload prints nothing rather than blank From and
 * To fields.
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

/** The header already names the place, the link repeats it only in a tooltip. */
function mapLinkLabel(cmuMaps: CmuMapsPayload): string {
  return cmuMaps.targetLabel ?? cmuMaps.destLabel ?? "this route";
}

/**
 * The icon spins during reload and finishes its current turn before stopping,
 * so it never snaps upright mid rotation.
 */
function MapReloadButton({ reloading, onReload }: { reloading: boolean; onReload: () => void }) {
  const [spinning, setSpinning] = useState(false);
  return (
    <button
      type="button"
      className={MAP_RELOAD_CLASS}
      title="Reload the embedded map"
      onClick={() => {
        setSpinning(true);
        onReload();
      }}
    >
      {/* The animation lives on a wrapper because animationiteration fires at
          whole turn boundaries, where stopping looks right. */}
      <span
        className={`inline-flex ${
          spinning ? "animate-spin [animation-duration:0.7s] motion-reduce:animate-none" : ""
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
  );
}

export function MapHeader({
  cmuMaps,
  mapUrl,
  reloading,
  onReload,
}: {
  cmuMaps: CmuMapsPayload;
  mapUrl: string;
  reloading: boolean;
  onReload: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-neutral-200 border-b bg-neutral-50 px-3 py-2 text-neutral-500 text-xs">
      {mapHeaderFacts(cmuMaps).map((fact) => (
        <span key={fact.label}>
          {fact.label}: {fact.value}
        </span>
      ))}
      <div className="ml-auto flex items-center gap-2">
        <MapReloadButton reloading={reloading} onReload={onReload} />
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
  );
}
