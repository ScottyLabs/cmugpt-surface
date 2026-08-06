/**
 * URL handling for CMU Maps, the separate web app the chat embeds in an
 * iframe for building and route answers.
 */

export const CMU_MAPS_ORIGIN = "https://maps.scottylabs.org";

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

/**
 * The map URL to embed, or null when it is not on the CMU Maps origin. The
 * origin check is what makes the iframe permissions safe, so every embedded
 * map URL must pass through here. Also renames the legacy dest parameter to
 * dst. The agent addresses buildings by code, so waypoints need no rewriting.
 */
export function normalizedCmuMapsUrl(url: string | null | undefined): string | null {
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
 * Prefetch a map page before the iframe exists. The URL arrives while the
 * answer streams but the iframe mounts only once it completes. The link
 * element is never removed because removal can cancel an in flight download.
 */
export function prefetchMapDocument(url: string): void {
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
