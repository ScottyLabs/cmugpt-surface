/**
 * CMU Maps is a separate web app, hosted at the origin below, that the chat
 * embeds in an iframe when an answer is about a campus building or a walking
 * route. This file covers the URLs that point at it.
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
 * The map URL to embed, or null if it does not point at CMU Maps. Turning away
 * every other origin is what makes it safe to load the result into an iframe
 * with as many permissions as this one gets, so nothing should embed a map URL
 * without passing it through here. The rewrite below translates an older name
 * for the destination parameter.
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
