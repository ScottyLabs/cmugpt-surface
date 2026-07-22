import { env } from "../env.ts";

const defaultAllowedOrigins = ["http://localhost:4173", "http://127.0.0.1:4173"];

export const allowedOrigins: string[] = [
  ...defaultAllowedOrigins,
  ...env.ALLOWED_ORIGINS_REGEX.split(",").map((s) => s.trim()),
].filter(Boolean);

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function matchesAllowedOrigin(origin: string, allowedOrigin: string): boolean {
  try {
    if (origin === new URL(allowedOrigin).origin) {
      return true;
    }
  } catch {
    // Not a URL; fall through to pattern matching.
  }

  try {
    return new RegExp(allowedOrigin, "u").test(origin);
  } catch {
    return origin === allowedOrigin || origin === `^${escapeRegExp(allowedOrigin)}$`;
  }
}

export function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins.some((allowedOrigin) => matchesAllowedOrigin(origin, allowedOrigin));
}
