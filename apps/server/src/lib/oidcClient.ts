// Server-side OIDC via openid-client (panva). Handles discovery, PKCE, the
// authorization URL, code exchange (with id_token validation), refresh, and
// logout -- so we never hand-roll OIDC crypto. Ricochet support lives in
// authRoutes.ts: we choose the redirect_uri and craft the `state`; this module
// just runs the protocol.
import * as client from "openid-client";
import { env } from "../env.ts";

export interface OidcTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  // epoch ms
  accessTokenExpiresAt?: number;
}

export interface OidcClaims {
  sub: string;
  email?: string;
  givenName?: string;
  groups?: string[];
}

export const SCOPE = "openid profile email";

let configPromise: Promise<client.Configuration> | null = null;

function getConfiguredOidcParams(): { issuerUrl: string; clientId: string; clientSecret: string } {
  const { OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET } = env;
  if (
    OIDC_ISSUER_URL === undefined ||
    OIDC_ISSUER_URL === "" ||
    OIDC_CLIENT_ID === undefined ||
    OIDC_CLIENT_ID === "" ||
    OIDC_CLIENT_SECRET === undefined ||
    OIDC_CLIENT_SECRET === ""
  ) {
    throw new Error("OIDC is not configured");
  }
  return { issuerUrl: OIDC_ISSUER_URL, clientId: OIDC_CLIENT_ID, clientSecret: OIDC_CLIENT_SECRET };
}

function getConfig(): Promise<client.Configuration> {
  if (!configPromise) {
    const { issuerUrl, clientId, clientSecret } = getConfiguredOidcParams();
    configPromise = client.discovery(new URL(issuerUrl), clientId, clientSecret).catch((err) => {
      // don't cache a failed discovery
      configPromise = null;
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
  return client.buildAuthorizationUrl(config, {
    redirect_uri: params.redirectUri,
    scope: SCOPE,
    response_type: "code",
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  }).href;
}

function toTokens(
  res: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
): OidcTokens {
  const tokens: OidcTokens = { accessToken: res.access_token };
  if (res.refresh_token !== undefined) tokens.refreshToken = res.refresh_token;
  if (res.id_token !== undefined) tokens.idToken = res.id_token;
  const expiresIn = res.expiresIn();
  if (typeof expiresIn === "number") tokens.accessTokenExpiresAt = Date.now() + expiresIn * 1000;
  return tokens;
}

function claimStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function extractClaims(idClaims: Record<string, unknown>): OidcClaims {
  const realmAccess: unknown = idClaims.realm_access;
  const roles =
    typeof realmAccess === "object" && realmAccess !== null && "roles" in realmAccess
      ? realmAccess.roles
      : undefined;
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
  if (idClaims === undefined || idClaims.sub === "") throw new Error("id_token missing sub");
  return { tokens: toTokens(res), claims: extractClaims(idClaims) };
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
  if (env.OIDC_CLIENT_ID === undefined || env.OIDC_CLIENT_ID === "") {
    return null;
  }
  try {
    return client.buildEndSessionUrl(config, {
      post_logout_redirect_uri: params.postLogoutRedirectUri,
      client_id: env.OIDC_CLIENT_ID,
      ...(params.idToken === undefined ? {} : { id_token_hint: params.idToken }),
    }).href;
  } catch {
    // Provider may not advertise an end_session_endpoint.
    return null;
  }
}
