import process from "node:process";
import { env } from "../env.ts";
import { createOriginMatcher, isLoopbackOrigin, siblingWebOrigin } from "./originMatcher.ts";

const defaultAllowedOrigins = ["http://localhost:4173", "http://127.0.0.1:4173"];

// Kennel sets APP_URL per deployment, so previews and staging trust exactly their own web site without listing it in configuration.
const deploymentWebOrigin = siblingWebOrigin(env.APP_URL);

// Built once at startup so an invalid entry fails the boot, not a request.
const matchesConfiguredOrigin = createOriginMatcher([
  ...defaultAllowedOrigins,
  ...(deploymentWebOrigin === null ? [] : [deploymentWebOrigin]),
  ...env.ALLOWED_ORIGINS_REGEX.split(","),
]);

const isDevelopment = process.env["NODE_ENV"] === "development";

export function isAllowedOrigin(origin: string): boolean {
  // Development additionally accepts local servers on any port, never other hosts.
  return matchesConfiguredOrigin(origin) || (isDevelopment && isLoopbackOrigin(origin));
}
