// https://tsoa-community.github.io/docs/authentication.html#authentication
// https://medium.com/@alexandre.penombre/tsoa-the-library-that-will-supercharge-your-apis-c551c8989081

import { fromNodeHeaders } from "better-auth/node";
import type * as express from "express";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { env } from "../env.ts";
import type { HttpError } from "../middlewares/errorHandler.ts";
import {
  AuthenticationError,
  AuthorizationError,
  InternalServerError,
} from "../middlewares/errorHandler.ts";
import { auth } from "./auth.ts";

export const OIDC_AUTH = "oidc";
export const BEARER_AUTH = "bearerAuth";
/** Single TSOA security: session cookie and/or Bearer, merged (see {@link resolveMergedOidcBearerUser}). */
export const OIDC_OR_BEARER_AUTH = "oidcOrBearer";
export const ADMIN_SCOPE = "stack-admins";
export const MEMBER_SCOPE = "stack-devs";

declare module "express" {
  interface Request {
    authErrors?: HttpError[];
    // TSAO `resolve` will attach the user object to the request object
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

/**
 * Merge cookie session + bearer identities so `groups` from the JWT is not dropped
 * when OIDC resolves first without claims (race with {@link Promise.any}).
 */
function mergeAuthenticatedUsers(users: Express.User[]): Express.User {
  const [first, ...rest] = users;
  if (first === undefined) {
    throw new InternalServerError("mergeAuthenticatedUsers: empty");
  }
  const groupSet = new Set<string>();
  for (const g of first.groups ?? []) {
    groupSet.add(g);
  }
  for (const u of rest) {
    for (const g of u.groups ?? []) {
      groupSet.add(g);
    }
  }
  const merged: Express.User = {
    sub: first.sub,
    ...(first.email !== undefined ? { email: first.email } : {}),
    ...(first.givenName !== undefined ? { givenName: first.givenName } : {}),
    ...(groupSet.size > 0 ? { groups: [...groupSet] } : {}),
  };
  return merged;
}

/**
 * Run cookie session + Bearer together and merge identities (groups, etc.).
 * Used by {@link requireOidcOrBearer} and TSOA {@link OIDC_OR_BEARER_AUTH}.
 */
export async function resolveMergedOidcBearerUser(
  request: express.Request,
): Promise<Express.User> {
  request.authErrors = request.authErrors ?? [];

  const results = await Promise.allSettled([
    expressAuthentication(request, OIDC_AUTH, []),
    expressAuthentication(request, BEARER_AUTH, []),
  ]);

  const users: Express.User[] = [];
  const failures: unknown[] = [];

  for (const r of results) {
    if (r.status === "fulfilled") {
      users.push(r.value as Express.User);
    } else {
      failures.push(r.reason);
    }
  }

  if (users.length === 0) {
    const error = (failures[failures.length - 1] ??
      new AuthenticationError(
        "merged auth: no strategy succeeded (see allAuthErrors in prior log)",
      )) as HttpError;
    error.status = error.status || 401;
    if (failures.length > 1) {
      console.warn(
        "[auth] resolveMergedOidcBearerUser: all strategies failed",
        {
          errors: failures.map((e) =>
            e instanceof Error ? e.message : String(e),
          ),
        },
      );
    }
    throw error;
  }

  return mergeAuthenticatedUsers(users);
}

/**
 * Same auth as chat routes: session cookie (OIDC) and/or bearer JWT — results are
 * merged (not raced) so group claims stay available for admin checks.
 */
export async function requireOidcOrBearer(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction,
): Promise<void> {
  try {
    request.user = await resolveMergedOidcBearerUser(request);
    if (response.writableEnded) {
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function expressAuthentication(
  request: express.Request,
  securityName: string,
  scopes?: string[],
) {
  // Store all authentication errors in the request object
  // so we can return the most relevant error to the client in errorHandler
  request.authErrors = request.authErrors ?? [];

  if (securityName === OIDC_OR_BEARER_AUTH) {
    if (scopes != null && scopes.length > 0) {
      const err = new InternalServerError(
        "oidcOrBearer does not support scopes; use oidc and bearerAuth on the route instead",
      );
      request.authErrors.push(err);
      return Promise.reject(err);
    }
    return resolveMergedOidcBearerUser(request);
  }

  return new Promise((resolve, reject) => {
    if (securityName === OIDC_AUTH) {
      return validateOidc(request, reject, resolve, scopes);
    }

    if (securityName === BEARER_AUTH) {
      return verifyBearerAuth(request, reject, resolve, scopes);
    }

    const err = new InternalServerError("Invalid security name");
    request.authErrors?.push(err);
    return reject(err);
  });
}

function sessionUserToExpressUser({
  id,
  email,
  name,
  groups,
}: {
  id: string;
  email: string;
  name: string;
  /** Set by better-auth `customSession` when the IdP access token exposes `groups`. */
  groups?: string[];
}): Express.User {
  return {
    sub: id,
    email,
    givenName: name,
    ...(groups !== undefined && groups.length > 0 ? { groups } : {}),
  };
}

// Verify OpenID Connect Authentication by checking the user object and scopes
async function validateOidc(
  request: express.Request,
  reject: (value: unknown) => void,
  resolve: (value: unknown) => void,
  scopes?: string[],
) {
  const needsScopeClaims = Boolean(scopes && scopes.length > 0);

  try {
    // https://www.better-auth.com/docs/integrations/express
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session?.user) {
      const err = new AuthenticationError(
        "oidc: no session or session.user (cookie missing, wrong domain, or session expired)",
      );
      request.authErrors?.push(err);
      return reject(err);
    }

    let decoded: jwt.JwtPayload | string | null = null;
    try {
      const accessToken = await auth.api.getAccessToken({
        body: { providerId: "keycloak" },
        headers: fromNodeHeaders(request.headers),
      });
      decoded = jwt.decode(accessToken.accessToken);
    } catch (error) {
      if (needsScopeClaims) {
        console.error(
          "[auth] oidc: getAccessToken failed (scoped route)",
          error,
        );
        const err = new AuthenticationError(
          `oidc: getAccessToken failed — ${error instanceof Error ? error.message : String(error)}`,
        );
        request.authErrors?.push(err);
        return reject(err);
      }
    }

    if (!needsScopeClaims) {
      if (decoded !== null && typeof decoded === "object" && decoded.sub) {
        const fromToken = decodedTokenToUser(decoded);
        const sessionUser = session.user as typeof session.user & {
          groups?: string[];
        };
        const sessionGroups = sessionUser.groups;
        if (
          (!fromToken.groups || fromToken.groups.length === 0) &&
          sessionGroups !== undefined &&
          sessionGroups.length > 0
        ) {
          fromToken.groups = sessionGroups;
        }
        return resolve(fromToken);
      }
      return resolve(sessionUserToExpressUser(session.user));
    }

    if (decoded === null || typeof decoded !== "object") {
      const err = new AuthenticationError(
        "oidc: access token missing or not a decodable JWT (required for scoped route)",
      );
      request.authErrors?.push(err);
      return reject(err);
    }

    if (!hasAnyScope(decoded["groups"] ?? [], scopes)) {
      return scopeValidationError(request, reject);
    }

    return resolve(decodedTokenToUser(decoded));
  } catch (error) {
    console.error("[auth] oidc: unexpected error in validateOidc", error);
    const err = new AuthenticationError(
      `oidc: validateOidc threw — ${error instanceof Error ? error.message : String(error)}`,
    );
    request.authErrors?.push(err);
    return reject(err);
  }
}

// Verify Bearer Authentication by verifying the token and checking the scopes
const client = jwksClient({ jwksUri: env.AUTH_JWKS_URI });
function verifyBearerAuth(
  request: express.Request,
  reject: (value: unknown) => void,
  resolve: (value: unknown) => void,
  scopes?: string[],
) {
  const token = request.headers.authorization?.split(" ")[1];
  if (!token) {
    const err = new AuthenticationError(
      "bearer: no Authorization Bearer token on request",
    );
    request.authErrors?.push(err);
    return reject(err);
  }

  jwt.verify(
    token,
    (header, callback) => {
      client.getSigningKey(header.kid, (_error, key) => {
        if (!key) {
          console.error("[auth] bearer: JWKS missing key for kid", header.kid);
          const err = new AuthenticationError(
            `bearer: no JWKS signing key for kid=${header.kid ?? "undefined"}`,
          );
          request.authErrors?.push(err);
          return reject(err);
        }

        const signingKey = key.getPublicKey();
        callback(null, signingKey);
      });
    },
    { issuer: env.AUTH_ISSUER, audience: env.AUTH_CLIENT_ID },
    (error, decoded) => {
      // Check if the token is valid
      if (error) {
        console.error("[auth] bearer: jwt.verify failed", error.message);
        const err = new AuthenticationError(
          `bearer: jwt.verify failed — ${error.message}`,
        );
        request.authErrors?.push(err);
        return reject(err);
      }

      // Check if the token format is valid
      if (!decoded || typeof decoded !== "object") {
        const err = new AuthenticationError(
          "bearer: JWT payload missing or not an object",
        );
        request.authErrors?.push(err);
        return reject(err);
      }

      // Check if the token contains any of the required scopes
      if (!hasAnyScope(decoded["groups"], scopes)) {
        return scopeValidationError(request, reject);
      }

      return resolve(decodedTokenToUser(decoded));
    },
  );
}

// Verify if the groups contain ANY of the required scopes
const hasAnyScope = (groups?: string[], scopes?: string[]) => {
  // If no scopes are required, return true
  if (!scopes || scopes.length === 0) {
    return true;
  }

  // If no groups are present, return false
  if (!groups || groups.length === 0) {
    return false;
  }

  // Check if any of the groups contain any of the required scopes
  return groups.some((group) => scopes.includes(group));
};

function scopeValidationError(
  request: express.Request,
  reject: (value: unknown) => void,
) {
  const err = new AuthorizationError(
    "Insufficient permissions to access this resource.",
  );
  request.authErrors?.push(err);
  return reject(err);
}

function decodedTokenToUser(decoded: jwt.JwtPayload) {
  return {
    sub: decoded.sub,
    email: decoded["email"],
    givenName: decoded["given_name"],
    groups: decoded["groups"],
  };
}
