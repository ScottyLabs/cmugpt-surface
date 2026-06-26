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
    if (!header.kid) {
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

async function verifyOidcAuth(request: express.Request): Promise<Express.User> {
  try {
    const authHeader = request.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    console.log("[auth] Verifying OIDC token...");

    if (!token) {
      const err = new AuthenticationError("No authentication token provided");
      request.authErrors?.push(err);
      throw err;
    }

    const decodedTokenResult = jwt.decode(token, { complete: true });
    if (!decodedTokenResult || !decodedTokenResult.header) {
      const err = new AuthenticationError("Invalid token header");
      request.authErrors?.push(err);
      throw err;
    }
    const header = decodedTokenResult.header as JwtHeader;
    if (!header) {
      const err = new AuthenticationError("Invalid token header");
      request.authErrors?.push(err);
      throw err;
    }

    const signingKey = await getSigningKey(header);
    const payload = await new Promise<OidcJwtPayload>((resolve, reject) => {
      jwt.verify(
        token,
        signingKey,
        {
          issuer: env.OIDC_ISSUER_URL,
          audience: env.OIDC_CLIENT_ID,
        },
        (err, decoded) => {
          if (err || !decoded || typeof decoded === "string") {
            reject(err ?? new Error("Invalid token"));
            return;
          }
          resolve(decoded as OidcJwtPayload);
        },
      );
    });

    if (!payload.sub) {
      const err = new AuthenticationError("Token missing subject claim (sub)");
      request.authErrors?.push(err);
      throw err;
    }

    const givenName =
      (typeof payload.given_name === "string" && payload.given_name) ||
      (typeof payload.name === "string" && payload.name) ||
      (typeof payload.preferred_username === "string" &&
        payload.preferred_username) ||
      payload.sub;

    // Build Express user from OIDC token
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

    console.log("[auth] ✅ Token verified successfully for user:", user.sub);
    return user;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    console.error("[auth] OIDC verification failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    const err = new AuthenticationError(
      `OIDC authentication failed: ${message}`,
    );
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
