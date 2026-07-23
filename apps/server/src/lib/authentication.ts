// https://tsoa-community.github.io/docs/authentication.html#authentication
// Generic OIDC authentication integration

import type * as express from "express";
import jwt, { type JwtHeader, type JwtPayload } from "jsonwebtoken";
import jwksRsa from "jwks-rsa";
import { env } from "../env.ts";
import {
  AuthenticationError,
  HttpError,
  InternalServerError,
} from "../middlewares/errorHandler.ts";

export const OIDC_AUTH = "oidc";

type OidcJwtPayload = JwtPayload & {
  email?: string;
  name?: string;
  // biome-ignore lint/style/useNamingConvention: OIDC standard claim
  preferred_username?: string;
  // biome-ignore lint/style/useNamingConvention: OIDC standard claim
  given_name?: string;
  groups?: string[];
  // biome-ignore lint/style/useNamingConvention: OIDC standard claim
  azp?: string;
  // biome-ignore lint/style/useNamingConvention: OIDC standard claim
  realm_access?: { roles?: string[] };
};

declare module "express" {
  interface Request {
    authErrors?: HttpError[];
    // TSOA `resolve` will attach the user object to the request object
    user?: Express.User;
  }
}

declare global {
  namespace Express {
    /**
     * Express.User interface
     *
     * Interface of the user object that is attached to the request object,
     * used by the server's controller methods.
     */
    interface User {
      sub: string;
      email?: string;
      givenName?: string;
      groups?: string[];
    }
  }
}

export function expressAuthentication(
  request: express.Request,
  securityName: string,
  _scopes?: string[],
): Promise<Express.User> {
  // Store all authentication errors in the request object
  // so we can return the most relevant error to the client in errorHandler
  request.authErrors = request.authErrors ?? [];

  if (securityName !== OIDC_AUTH) {
    const err = new InternalServerError("Invalid security name");
    request.authErrors?.push(err);
    throw err;
  }

  return verifyOidcAuth(request);
}

const jwksClient = jwksRsa({
  jwksUri: `${env.OIDC_ISSUER_URL}/protocol/openid-connect/certs`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getSigningKey(header: JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    if (header.kid === undefined || header.kid === "") {
      reject(new Error("Missing kid in token header"));
      return;
    }
    jwksClient.getSigningKey(header.kid, (err, key) => {
      if (err || !key) {
        reject(err ?? new Error("Failed to load signing key"));
        return;
      }
      const signingKey = key.getPublicKey();
      if (!signingKey) {
        reject(new Error("Signing key missing public key"));
        return;
      }
      resolve(signingKey);
    });
  });
}

function extractGroups(payload: OidcJwtPayload): string[] | undefined {
  if (Array.isArray(payload.groups)) {
    return payload.groups.filter((group) => typeof group === "string");
  }
  const roles = payload.realm_access?.roles;
  if (Array.isArray(roles)) {
    return roles.filter((role) => typeof role === "string");
  }
  return undefined;
}

function raiseAuthError(request: express.Request, message: string): never {
  const err = new AuthenticationError(message);
  request.authErrors?.push(err);
  throw err;
}

function extractBearerToken(request: express.Request): string {
  const authHeader = request.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) {
    raiseAuthError(request, "No authentication token provided");
  }
  return token;
}

function decodeTokenHeader(request: express.Request, token: string): JwtHeader {
  const decodedTokenResult = jwt.decode(token, { complete: true });
  if (!decodedTokenResult) {
    raiseAuthError(request, "Invalid token header");
  }
  return decodedTokenResult.header;
}

function verifyTokenClaims(token: string, signingKey: string): Promise<OidcJwtPayload> {
  return new Promise((resolve, reject) => {
    // No `audience` here: Keycloak access tokens carry the resource server in
    // `aud` (often "account"), not the client_id. Authorization for our client
    // is asserted below via `azp` (or `aud` if it does contain the client).
    jwt.verify(token, signingKey, { issuer: env.OIDC_ISSUER_URL }, (err, decoded) => {
      if (err || decoded === undefined || typeof decoded === "string") {
        reject(err ?? new Error("Invalid token"));
        return;
      }
      resolve(decoded);
    });
  });
}

// Ensure the token was issued to our client (Keycloak sets `azp` to the
// authorized party). Also accept an explicit audience match if present.
function buildAuthenticatedUser(request: express.Request, payload: OidcJwtPayload): Express.User {
  if (!env.OIDC_CLIENT_ID) {
    raiseAuthError(request, "OIDC client not configured");
  }
  const aud = payload.aud;
  const audienceOk =
    payload.azp === env.OIDC_CLIENT_ID ||
    (Array.isArray(aud) ? aud.includes(env.OIDC_CLIENT_ID) : aud === env.OIDC_CLIENT_ID);
  if (!audienceOk) {
    raiseAuthError(request, "Token not authorized for this client");
  }

  if (payload.sub === undefined || payload.sub === "") {
    raiseAuthError(request, "Token missing subject claim (sub)");
  }

  const givenName =
    (typeof payload.given_name === "string" && payload.given_name) ||
    (typeof payload.name === "string" && payload.name) ||
    (typeof payload.preferred_username === "string" && payload.preferred_username) ||
    payload.sub;

  const user: Express.User = {
    sub: payload.sub,
    givenName: givenName || "User",
  };
  if (payload.email !== undefined) {
    user.email = payload.email;
  }
  const groups = extractGroups(payload);
  if (groups && groups.length > 0) {
    user.groups = groups;
  }

  return user;
}

async function verifyOidcAuth(request: express.Request): Promise<Express.User> {
  try {
    const token = extractBearerToken(request);
    const header = decodeTokenHeader(request, token);
    const signingKey = await getSigningKey(header);
    const payload = await verifyTokenClaims(token, signingKey);
    return buildAuthenticatedUser(request, payload);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    console.error("[auth] OIDC verification failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    const err = new AuthenticationError(`OIDC authentication failed: ${message}`);
    request.authErrors?.push(err);
    throw err;
  }
}

/**
 * Middleware to protect routes with OIDC authentication
 */
export async function requireOidcAuth(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction,
): Promise<void> {
  try {
    request.user = await expressAuthentication(request, OIDC_AUTH, []);
    if (response.writableEnded) {
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
