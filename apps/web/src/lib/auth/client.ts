import type { auth } from "@cmugpt-frontend/server/src/lib/auth";
import { customSessionClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "@/env.ts";

// https://www.better-auth.com/docs/installation#create-client-instance
const authClient = createAuthClient({
  // biome-ignore lint/style/useNamingConvention: defined by better-auth
  baseURL: env.VITE_SERVER_URL,
  // https://www.better-auth.com/docs/concepts/session-management#customizing-session-response
  plugins: [customSessionClient<typeof auth>()],
});

/** Keycloak access JWT for `Authorization: Bearer` (API bearerAuth). Not the Better Auth cookie secret. */
let keycloakTokenCache: { token: string; expiresAtMs: number } | null = null;
let keycloakTokenInflight: Promise<string | null> | null = null;

function clearKeycloakAccessTokenCache() {
  keycloakTokenCache = null;
  keycloakTokenInflight = null;
}

/**
 * Returns the OAuth access token from Better Auth (backed by Keycloak). Used as Bearer JWT for TSOA `bearerAuth`.
 * Session cookies remain for Better Auth; this is the IdP access token the server verifies via JWKS.
 */
export function getKeycloakAccessTokenForApi(): Promise<string | null> {
  const now = Date.now();
  const refreshSkewMs = 30_000;
  if (
    keycloakTokenCache &&
    keycloakTokenCache.expiresAtMs > now + refreshSkewMs
  ) {
    return Promise.resolve(keycloakTokenCache.token);
  }
  if (keycloakTokenInflight) {
    return keycloakTokenInflight;
  }
  keycloakTokenInflight = (async () => {
    try {
      const res = await authClient.getAccessToken({ providerId: "keycloak" });
      if (res.error || !res.data?.accessToken) {
        return null;
      }
      const { accessToken, accessTokenExpiresAt } = res.data;
      const expiresAtMs = accessTokenExpiresAt
        ? new Date(accessTokenExpiresAt).getTime()
        : now + 5 * 60_000;
      keycloakTokenCache = { token: accessToken, expiresAtMs };
      return accessToken;
    } catch {
      return null;
    } finally {
      keycloakTokenInflight = null;
    }
  })();
  return keycloakTokenInflight;
}

export function signIn() {
  authClient.signIn
    .social({
      provider: "keycloak",
      // biome-ignore lint/style/useNamingConvention: defined by better-auth
      callbackURL: window.location.href,
    })
    .then((result) => {
      if (result.error) {
        console.error(result.error);
      }
    });
}

export function signOut() {
  clearKeycloakAccessTokenCache();
  authClient.signOut().then((result) => {
    if (result.error) {
      console.error(result.error);
    }
  });
}

export const { useSession } = authClient;
