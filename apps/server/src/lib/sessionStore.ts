// Postgres-backed server sessions for the BFF flow, plus short-lived
// pending-login (PKCE/state) records. The session id is an opaque random token
// in an httpOnly cookie; Keycloak tokens live only in the DB.
import crypto from "node:crypto";
import type { Request } from "express";
import { eq, lt } from "drizzle-orm";
import { db } from "../db/index.ts";
import { authSessions, oidcLoginStates } from "../db/schema.ts";
import type { OidcClaims, OidcTokens } from "./oidcClient.ts";

export const SESSION_COOKIE = "sid";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const LOGIN_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface AuthSession {
  id: string;
  sub: string;
  email: string | null;
  givenName: string | null;
  groups: string[] | null;
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: Date | null;
  expiresAt: Date;
}

function randomId(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// --- cookie parsing (read-only; res.cookie handles writes) -----------------

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

// --- pending logins --------------------------------------------------------

export async function createLoginState(params: {
  state: string;
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
  returnTo: string;
}): Promise<void> {
  await db.insert(oidcLoginStates).values({
    state: params.state,
    codeVerifier: params.codeVerifier,
    nonce: params.nonce,
    redirectUri: params.redirectUri,
    returnTo: params.returnTo,
    expiresAt: new Date(Date.now() + LOGIN_STATE_TTL_MS),
  });
}

/** Fetch and delete a pending login by state; null if missing or expired. */
export async function consumeLoginState(state: string): Promise<{
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
  returnTo: string;
} | null> {
  const [row] = await db
    .delete(oidcLoginStates)
    .where(eq(oidcLoginStates.state, state))
    .returning();
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return {
    codeVerifier: row.codeVerifier,
    nonce: row.nonce,
    redirectUri: row.redirectUri,
    returnTo: row.returnTo,
  };
}

// --- sessions --------------------------------------------------------------

export async function createSession(claims: OidcClaims, tokens: OidcTokens): Promise<string> {
  const id = randomId();
  await db.insert(authSessions).values({
    id,
    sub: claims.sub,
    email: claims.email ?? null,
    givenName: claims.givenName ?? null,
    groups: claims.groups ?? null,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? null,
    idToken: tokens.idToken ?? null,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt
      ? new Date(tokens.accessTokenExpiresAt)
      : null,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return id;
}

export async function getSession(id: string): Promise<AuthSession | null> {
  const [row] = await db.select().from(authSessions).where(eq(authSessions.id, id));
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await deleteSession(id);
    return null;
  }
  return row;
}

/** Persist rotated tokens after a refresh. */
export async function updateSessionTokens(id: string, tokens: OidcTokens): Promise<void> {
  await db
    .update(authSessions)
    .set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      idToken: tokens.idToken ?? null,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt
        ? new Date(tokens.accessTokenExpiresAt)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(authSessions.id, id));
}

export async function deleteSession(id: string): Promise<void> {
  await db.delete(authSessions).where(eq(authSessions.id, id));
}

/** Best-effort cleanup of expired rows. */
export async function purgeExpired(): Promise<void> {
  const now = new Date();
  await db.delete(oidcLoginStates).where(lt(oidcLoginStates.expiresAt, now));
  await db.delete(authSessions).where(lt(authSessions.expiresAt, now));
}
