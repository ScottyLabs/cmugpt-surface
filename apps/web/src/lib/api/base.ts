// For kennel ephemeral preview deployments, the web is at *-web-<branch>.scottylabs.net
// and the API is at *-api-<branch>.scottylabs.net. Detect this at runtime so the same
// Nix build artifact works for both production (uses PUBLIC_API_URL) and preview.
async function resolveApiBaseUrl(): Promise<string> {
  const { protocol, hostname } = globalThis.location;
  const m = hostname.match(/^(.+)-web-(.+\.scottylabs\.net)$/u);
  if (m) return `${protocol}//${m[1]}-api-${m[2]}`;

  const response = await fetch("/_kennel/env.json");
  const env = response.ok ? ((await response.json()) as { PUBLIC_API_URL?: string }) : {};
  return env.PUBLIC_API_URL ?? "";
}

export const API_BASE_URL: string = await resolveApiBaseUrl();
