/**
 * URL handling for CMU Maps, the separate web app the chat embeds in an
 * iframe for building and route answers.
 */
import { cmuMapsBuildingCode } from "./cmuMapsPlaces.ts";

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

/** Query parameters naming the ends of a route. */
const ROUTE_PARAMS = ["src", "dst"];

/** Percent decoded path segment. Undecodable escapes are returned as written
 *  and match no building. */
function decodedPath(parsed: URL): string {
  const path = parsed.pathname.slice(1);
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * Rewrite each place name in the URL to its CMU Maps building code. Names that
 * resolve to no single building pass through unchanged, since a wrong guess
 * would route to the wrong building.
 */
function applyBuildingCodes(parsed: URL): void {
  // The path is the place the map opens on. Multi segment paths are rooms,
  // floors, or map internal routes, which cmuMapsBuildingCode declines anyway.
  const code = cmuMapsBuildingCode(decodedPath(parsed));
  if (code !== null) {
    parsed.pathname = `/${code}`;
  }
  for (const param of ROUTE_PARAMS) {
    const value = parsed.searchParams.get(param);
    const paramCode = value === null ? null : cmuMapsBuildingCode(value);
    if (paramCode !== null) {
      parsed.searchParams.set(param, paramCode);
    }
  }
}

/**
 * The map URL to embed, or null when it is not on the CMU Maps origin. The
 * origin check is what makes the iframe permissions safe, so every embedded
 * map URL must pass through here. Also renames the legacy dest parameter to
 * dst and rewrites place names to building codes.
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
  applyBuildingCodes(parsed);
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
