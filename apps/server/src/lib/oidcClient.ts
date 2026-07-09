// Server-side OIDC via openid-client (panva). Handles discovery, PKCE, the
// authorization URL, code exchange (with id_token validation), refresh, and
// logout — so we never hand-roll OIDC crypto. Ricochet support lives in
// authRoutes.ts: we choose the redirect_uri and craft the `state`; this module
// just runs the protocol.
import * as client from "openid-client";
import { env } from "../env.ts";

export interface OidcTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  accessTokenExpiresAt?: number; // epoch ms
}

export interface OidcClaims {
  sub: string;
  email?: string;
  givenName?: string;
  groups?: string[];
}

export const SCOPE = "openid profile email";

let configPromise: Promise<client.Configuration> | null = null;

function getConfig(): Promise<client.Configuration> {
  if (!configPromise) {
    configPromise = client
      .discovery(new URL(env.OIDC_ISSUER_URL), env.OIDC_CLIENT_ID, env.OIDC_CLIENT_SECRET)
      .catch((err) => {
        configPromise = null; // don't cache a failed discovery
        throw err;
      });
  }
  return configPromise;
}

export function randomState(): string {
  return client.randomState();
}

export function randomNonce(): string {
  return client.randomNonce();
}

export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = client.randomPKCECodeVerifier();
  const challenge = await client.calculatePKCECodeChallenge(verifier);
  return { verifier, challenge };
}

export async function buildAuthorizeUrl(params: {
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): Promise<string> {
  const config = await getConfig();
  return client
    .buildAuthorizationUrl(config, {
      redirect_uri: params.redirectUri,
      scope: SCOPE,
      response_type: "code",
      state: params.state,
      nonce: params.nonce,
      code_challenge: params.codeChallenge,
      code_challenge_method: "S256",
    })
    .href;
}

function toTokens(res: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers): OidcTokens {
  const tokens: OidcTokens = { accessToken: res.access_token };
  if (res.refresh_token) tokens.refreshToken = res.refresh_token;
  if (res.id_token) tokens.idToken = res.id_token;
  const expiresIn = res.expiresIn();
  if (typeof expiresIn === "number") tokens.accessTokenExpiresAt = Date.now() + expiresIn * 1000;
  return tokens;
}

function claimStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function extractClaims(idClaims: Record<string, unknown>): OidcClaims {
  const roles = (idClaims.realm_access as { roles?: unknown } | undefined)?.roles;
  const groups = Array.isArray(idClaims.groups)
    ? idClaims.groups.filter((g): g is string => typeof g === "string")
    : Array.isArray(roles)
      ? roles.filter((r): r is string => typeof r === "string")
      : undefined;
  return {
    sub: claimStr(idClaims.sub) ?? "",
    email: claimStr(idClaims.email),
    givenName:
      claimStr(idClaims.given_name) ??
      claimStr(idClaims.name) ??
      claimStr(idClaims.preferred_username) ??
      claimStr(idClaims.sub),
    groups: groups && groups.length > 0 ? groups : undefined,
  };
}

/**
 * Exchange the authorization code. `callbackUrl` must have the token-request
 * redirect_uri as its origin+path (openid-client strips the query and uses it),
 * so in relay mode we pass the relay URL carrying the incoming query. Validates
 * state + nonce and the id_token.
 */
export async function exchangeCode(params: {
  callbackUrl: URL;
  expectedState: string;
  expectedNonce: string;
  codeVerifier: string;
}): Promise<{ tokens: OidcTokens; claims: OidcClaims }> {
  const config = await getConfig();
  const res = await client.authorizationCodeGrant(config, params.callbackUrl, {
    expectedState: params.expectedState,
    expectedNonce: params.expectedNonce,
    pkceCodeVerifier: params.codeVerifier,
    idTokenExpected: true,
  });
  const idClaims = res.claims();
  if (!idClaims?.sub) throw new Error("id_token missing sub");
  return { tokens: toTokens(res), claims: extractClaims(idClaims as Record<string, unknown>) };
}

export async function refreshTokens(refreshToken: string): Promise<OidcTokens> {
  const config = await getConfig();
  return toTokens(await client.refreshTokenGrant(config, refreshToken));
}

export async function buildLogoutUrl(params: {
  idToken?: string;
  postLogoutRedirectUri: string;
}): Promise<string | null> {
  const config = await getConfig();
  try {
    return client.buildEndSessionUrl(config, {
      post_logout_redirect_uri: params.postLogoutRedirectUri,
      client_id: env.OIDC_CLIENT_ID,
      ...(params.idToken ? { id_token_hint: params.idToken } : {}),
    }).href;
  } catch {
    // Provider may not advertise an end_session_endpoint.
    return null;
  }
}
