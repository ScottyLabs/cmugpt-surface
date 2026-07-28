/**
 * CMU Maps is a separate web app, hosted at the origin below, that the chat
 * embeds in an iframe when an answer is about a campus building or a walking
 * route. This file covers the URLs that point at it.
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

/** The two query parameters naming the ends of a route. */
const ROUTE_PARAMS = ["src", "dst"];

/** The path as it was written, with `%20` and the like turned back into the
 *  characters they stand for. Undecodable escapes are left alone to be matched
 *  as they are, which simply finds no building. */
function decodedPath(parsed: URL): string {
  const path = parsed.pathname.slice(1);
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * Replace each place the URL names with the building code CMU Maps knows it by.
 * Anything that names no single building is left exactly as it came: an
 * identifier the map rejects is no worse than one this cannot improve, and a
 * wrong guess would silently draw a route to the wrong building.
 */
function applyBuildingCodes(parsed: URL): void {
  // The path is the place the map opens on, and is the whole of it: a URL
  // deeper than one segment is a room, a floor, or a route of the map's own,
  // which `cmuMapsBuildingCode` declines to touch anyway.
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
 * The map URL to embed, or null if it does not point at CMU Maps. Turning away
 * every other origin is what makes it safe to load the result into an iframe
 * with as many permissions as this one gets, so nothing should embed a map URL
 * without passing it through here. The rewrites below translate an older name
 * for the destination parameter, and the place names the agent writes into the
 * codes the map itself uses.
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
 * Ask the browser to download a map page before anything on screen displays it.
 * The server sends the URL partway through writing an answer, but the iframe is
 * not created until the answer is finished, so otherwise the download would not
 * start until then. The `<link>` is deliberately never removed: removing one
 * can cancel a download still in progress.
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
