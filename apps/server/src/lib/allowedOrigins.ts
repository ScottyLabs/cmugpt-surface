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
    // allowedOrigin comes from the ALLOWED_ORIGINS_REGEX env var (deployer-controlled config,
    // same trust level as OIDC_ISSUER_URL/DATABASE_URL/etc.), never from request input, so this
    // is not attacker-controlled ReDoS surface.
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    return new RegExp(allowedOrigin, "u").test(origin);
  } catch {
    return origin === allowedOrigin || origin === `^${escapeRegExp(allowedOrigin)}$`;
  }
}

export function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins.some((allowedOrigin) => matchesAllowedOrigin(origin, allowedOrigin));
}
