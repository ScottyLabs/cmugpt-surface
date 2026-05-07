// https://tsoa-community.github.io/docs/authentication.html#authentication
// Clerk authentication integration

import { verifyToken } from "@clerk/clerk-sdk-node";
import type * as express from "express";
import type jwt from "jsonwebtoken";
import { env } from "../env.ts";
import {
  AuthenticationError,
  HttpError,
  InternalServerError,
} from "../middlewares/errorHandler.ts";

export const CLERK_AUTH = "clerk";

type ClerkJwtPayload = jwt.JwtPayload & {
  email?: string;
  name?: string;
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

  if (securityName !== CLERK_AUTH) {
    const err = new InternalServerError("Invalid security name");
    request.authErrors?.push(err);
    throw err;
  }

  return verifyClerkAuth(request);
}

async function verifyClerkAuth(
  request: express.Request,
): Promise<Express.User> {
  try {
    const token =
      request.headers.authorization?.split(" ")[1] || request.cookies?.session;

    console.log("[auth] Verifying Clerk token...");

    if (!token) {
      const err = new AuthenticationError("No authentication token provided");
      request.authErrors?.push(err);
      throw err;
    }

    const secretKey = env.CLERK_SECRET_KEY;
    if (!secretKey) {
      const err = new InternalServerError("CLERK_SECRET_KEY not configured");
      request.authErrors?.push(err);
      throw err;
    }

    const payload = (await verifyToken(token, {
      issuer: env.CLERK_ISSUER_URL,
      secretKey,
    })) as ClerkJwtPayload;

    if (!payload || typeof payload === "string") {
      const err = new AuthenticationError("Invalid token structure");
      request.authErrors?.push(err);
      throw err;
    }

    if (!payload.sub) {
      const err = new AuthenticationError("Token missing subject claim (sub)");
      request.authErrors?.push(err);
      throw err;
    }

    const givenNameClaim = payload["given_name"];
    const givenName =
      typeof givenNameClaim === "string" ? givenNameClaim : payload.name;

    // Build Express user from Clerk token
    const user: Express.User = {
      sub: payload.sub,
      givenName: givenName || "User",
    };
    if (payload.email !== undefined) {
      user.email = payload.email;
    }

    console.log("[auth] ✅ Token verified successfully for user:", user.sub);
    return user;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    console.error("[auth] Clerk verification failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    const err = new AuthenticationError(
      `Clerk authentication failed: ${message}`,
    );
    request.authErrors?.push(err);
    throw err;
  }
}

/**
 * Middleware to protect routes with Clerk authentication
 */
export async function requireClerkAuth(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction,
): Promise<void> {
  try {
    request.user = await expressAuthentication(request, CLERK_AUTH, []);
    if (response.writableEnded) {
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
