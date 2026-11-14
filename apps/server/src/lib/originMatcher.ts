// Origin allowlist used by CORS, the cross-site request check, and the post-login redirect. Responses carry credentials, so an origin that matches here can read and change a signed-in user's data. Matching is therefore exact by default, and patterns must be anchored so they cannot match a longer attacker-controlled host such as `bark.scottylabs.org.evil.com`.

export type OriginMatcher = (origin: string) => boolean;

/**
 * Build a matcher from allowlist entries. Each entry is either an exact origin
 * (`https://bark.scottylabs.org`) or a regular expression anchored with `^`
 * and `$` (`^https://cmugpt-surface-web-pr-[0-9]+\.scottylabs\.net$`).
 * Anything else, including the former `.` default, throws, so a permissive
 * configuration stops the server at startup instead of exposing user data.
 */
export function createOriginMatcher(entries: readonly string[]): OriginMatcher {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];
  for (const raw of entries) {
    const entry = raw.trim();
    if (entry === "") continue;
    if (entry.startsWith("^") && entry.endsWith("$")) {
      // Deployer-controlled configuration, never request input.
      // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      patterns.push(new RegExp(entry, "u"));
      continue;
    }
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      throw new Error(
        `Allowed origin ${JSON.stringify(entry)} must be an exact origin such as ` +
          "https://example.org or a pattern anchored with ^ and $.",
      );
    }
    if (url.origin !== entry.replace(/\/$/u, "")) {
      throw new Error(
        `Allowed origin ${JSON.stringify(entry)} must be an origin without a path, ` +
          "query, or credentials.",
      );
    }
    exact.add(url.origin);
  }
  return (origin) => exact.has(origin) || patterns.some((pattern) => pattern.test(origin));
}

/**
 * The web origin deployed alongside this API, derived from Kennel's `APP_URL`
 * (the API's own public URL). On Kennel's generated domains the web site of
 * the same deployment differs only in the service name, `-api-` versus
 * `-web-`, mirroring how the web app finds its API in
 * `apps/web/src/lib/api/base.ts`. Returns null for custom domains, whose web
 * origin must be listed in `ALLOWED_ORIGINS_REGEX`.
 */
export function siblingWebOrigin(appUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(appUrl);
  } catch {
    return null;
  }
  const match = url.hostname.match(/^(.+?)-api-(.+\.scottylabs\.net)$/u);
  return match ? `${url.protocol}//${match[1]}-web-${match[2]}` : null;
}

/** Local development servers, on any port. */
export function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}
