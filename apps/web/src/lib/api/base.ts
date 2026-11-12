// For kennel ephemeral preview deployments, the web is at *-web-<branch>.scottylabs.net and the API is at *-api-<branch>.scottylabs.net. Detect this at runtime so the same
// Nix build artifact works for both production (uses PUBLIC_API_URL) and preview.
async function resolveApiBaseUrl(): Promise<string> {
  const { protocol, hostname } = globalThis.location;
  const m = hostname.match(/^(.+)-web-(.+\.scottylabs\.net)$/u);
  if (m) return `${protocol}//${m[1]}-api-${m[2]}`;

  return (await readPublicApiUrl()) ?? "";
}

// Kennel serves the public secretspec values at /_kennel/env.json. A failed or malformed response falls back to a same-origin API rather than leaving the app unable to start.
async function readPublicApiUrl(): Promise<string | undefined> {
  try {
    const response = await fetch("/_kennel/env.json");
    if (!response.ok) return undefined;
    const env: unknown = await response.json();
    if (typeof env === "object" && env !== null && "PUBLIC_API_URL" in env) {
      const { PUBLIC_API_URL: url } = env;
      return typeof url === "string" ? url : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export const API_BASE_URL: string = await resolveApiBaseUrl();
