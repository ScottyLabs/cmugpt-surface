import type { CmuMapsPayload } from "./types.ts";

/**
 * Matches an answer claiming it could not find a place. The model sometimes
 * says this even when the map lookup did succeed, in which case the text is
 * swapped for `cmuMapsSuccessText` rather than shown beside a working map.
 */
export const MAP_FAILURE_CLAIM_RE =
  /\b(wasn'?t able|was not able|couldn'?t|could not|unable|failed|didn'?t find|did not find)\b.{0,240}\b(location|building|map|directions?|path|route|tool|tools|retrieve)\b/isu;

/** A place name fit to show, or "N/A" when the server did not supply one. */
export function mapDisplayValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed !== "" ? (value ?? "N/A") : "N/A";
}

/** Replacement text for an answer that wrongly claims the map lookup failed. */
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
