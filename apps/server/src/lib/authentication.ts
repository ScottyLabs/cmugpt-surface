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
 * Same auth as chat routes: session cookie (OIDC) or bearer JWT (first to succeed).
 */
export async function requireOidcOrBearer(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction,
): Promise<void> {
  request.authErrors = request.authErrors ?? [];
  const failedAttempts: unknown[] = [];
  const pushAndRethrow = (error: unknown) => {
    failedAttempts.push(error);
    throw error;
  };
  const attempts = [
    expressAuthentication(request, OIDC_AUTH, []).catch(pushAndRethrow),
    expressAuthentication(request, BEARER_AUTH, []).catch(pushAndRethrow),
  ];
  try {
    request.user = (await Promise.any(attempts)) as Express.User;
    if (response.writableEnded) {
      return;
    }
    next();
  } catch (caught) {
    const error = (failedAttempts.pop() ??
      new AuthenticationError(
        "requireOidcOrBearer: no strategy succeeded (see allAuthErrors in prior log)",
      )) as HttpError;
    error.status = error.status || 401;
    if (caught instanceof AggregateError) {
      console.warn("[auth] requireOidcOrBearer: AggregateError", {
        errors: caught.errors.map((e) =>
          e instanceof Error ? e.message : String(e),
        ),
      });
    }
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

function sessionUserToExpressUser(user: {
  id: string;
  email: string;
  name: string;
}): Express.User {
  return {
    sub: user.id,
    email: user.email,
    givenName: user.name,
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
        return resolve(decodedTokenToUser(decoded));
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
