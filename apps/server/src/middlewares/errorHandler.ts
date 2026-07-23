import { DrizzleQueryError } from "drizzle-orm/errors";
import type { NextFunction, Request, Response } from "express";
import { ValidateError } from "tsoa";
import { AuthenticationError, HttpError } from "./errors.ts";

export {
  AuthenticationError,
  AuthorizationError,
  BadRequestError,
  HttpError,
  InternalServerError,
  NotFoundError,
} from "./errors.ts";

function authDebugOrMessage(e: HttpError) {
  return e instanceof AuthenticationError && e.authDebugReason !== undefined
    ? e.authDebugReason
    : e.message;
}

// The authentication errors take the highest priority
function handleAuthErrors(req: Request, res: Response) {
  const firstAuthError = req.authErrors?.[0];
  if (!req.authErrors || !firstAuthError) {
    return false;
  }

  // the most relevant error is the one with the highest status code
  // 500 (invalid security name here) > 403 Forbidden > 401 Unauthorized
  const errorToReturn = req.authErrors.reduce((max, currentError) => {
    return currentError.status > max.status ? currentError : max;
  }, firstAuthError);

  const chosenReason = authDebugOrMessage(errorToReturn);
  const allReasons = req.authErrors.map(authDebugOrMessage).join(" | ");
  // Single-line log so Turbo's dev TUI (and similar) is not corrupted by multiline objects.
  console.warn(
    `[auth-failure] ${req.method} ${req.path} -> ${errorToReturn.status} (${chosenReason}) [tried: ${allReasons}]; cookie=${Boolean(req.headers.cookie)} authorization=${Boolean(req.headers.authorization)}`,
  );

  res.status(errorToReturn.status).json({
    status: errorToReturn.status,
    error: errorToReturn.name,
    message: errorToReturn.message,
  });
  return true;
}

function handleValidationError(err: unknown, req: Request, res: Response) {
  if (!(err instanceof ValidateError)) {
    return false;
  }
  console.warn(`Caught Validation Error for ${req.path}:`, err.fields);
  res.status(422).json({
    message: "Validation Failed",
    details: err?.fields,
  });
  return true;
}

function handleHttpError(err: unknown, res: Response) {
  if (!(err instanceof HttpError)) {
    return false;
  }
  res.status(err.status).json({
    status: err.status,
    error: err.name,
    message: err.message,
  });
  return true;
}

// Drizzle wraps PG errors; log the driver message (e.g. missing column) in one line.
function handleDrizzleError(err: unknown, req: Request, res: Response) {
  if (!(err instanceof DrizzleQueryError)) {
    return false;
  }
  const pgDetail = err.cause instanceof Error ? err.cause.message : "";
  console.error(`[db-query] ${req.method} ${req.path}${pgDetail ? ` - ${pgDetail}` : ""}`);
  res.status(500).json({
    message: "Internal Server Error",
    details: err.message,
  });
  return true;
}

function handleUnknownError(err: unknown, req: Request, res: Response) {
  if (!(err instanceof Error)) {
    return false;
  }
  console.error(`Error ${req.path}`, err);
  res.status(500).json({ message: "Internal Server Error", details: err.message });
  return true;
}

// From https://tsoa-community.github.io/docs/error-handling.html
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (handleAuthErrors(req, res)) return;
  if (handleValidationError(err, req, res)) return;
  if (handleHttpError(err, res)) return;
  if (handleDrizzleError(err, req, res)) return;
  if (handleUnknownError(err, req, res)) return;

  next();
}
