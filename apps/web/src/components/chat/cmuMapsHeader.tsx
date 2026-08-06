/** The toolbar strip along the top of a CMU Maps card: what it shows, and the
 *  two buttons for reloading it and opening it in a new tab. */
import { ExternalLink, RotateCw } from "lucide-react";
import { useState } from "react";
import { mapDisplayValue } from "./cmuMapsText.ts";
import type { CmuMapsPayload } from "./types.ts";

/** Shared appearance for the two small buttons. */
const MAP_CHIP_CLASS =
  "inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-1.5 py-0.5";
const MAP_RELOAD_CLASS = `${MAP_CHIP_CLASS} text-neutral-600 hover:bg-neutral-100`;
/**
 * Red text, matching how links look everywhere else in an answer. The card sits
 * inside the container that styles assistant markdown (`markdownClass` in
 * ./markdown.tsx), whose link rules are descendant selectors and so beat plain
 * utility classes on the link itself. Every property those rules set needs a
 * `!` to win; the background and border they say nothing about do not.
 */
const MAP_LINK_CLASS = `${MAP_CHIP_CLASS} hover:bg-red-50 gap-1! text-red-800! no-underline!`;

/**
 * What the header states about the map. A route names both ends; a single-place
 * answer names one, and saying nothing beats printing two empty "From"/"To"
 * fields for a map with no route to describe.
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

/**
 * The icon spins while the map reloads, then keeps spinning until it completes
 * the turn it is in the middle of: dropping the animation the moment the map is
 * back would leave the icon mid-rotation and snap it upright.
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
      {/* The animation sits on a wrapper because this event fires only at the
          end of a whole turn, which is where the rotation has to stop. */}
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
