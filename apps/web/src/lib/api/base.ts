// For kennel ephemeral preview deployments, the web is at *-web-<branch>.scottylabs.net
// and the API is at *-api-<branch>.scottylabs.net. Detect this at runtime so the same
// Nix build artifact works for both production (uses VITE_API_URL) and preview.
function resolveApiBaseUrl(): string {
  if (typeof globalThis.location !== "undefined") {
    const { protocol, hostname } = globalThis.location;
    const m = hostname.match(/^(.+)-web-(.+\.scottylabs\.net)$/u);
    if (m) return `${protocol}//${m[1]}-api-${m[2]}`;
  }
  return import.meta.env.VITE_API_URL ?? "";
}

export const API_BASE_URL: string = resolveApiBaseUrl();
