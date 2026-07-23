/** biome-ignore-all lint/style/useNamingConvention: environment variables are in SCREAMING_CASE */
import process from "node:process";
import { z } from "zod";

// kennel resolves every secret declared in secretspec.toml itself (with its
// own vault credentials) and injects the results as plain env vars into the
// deployed process, so this schema only ever needs to read process.env - the
// secretspec SDK's own runtime resolver must not run here, since the
// deployed sandbox has no vault token of its own.

// Define the schema as an object with all of the env variables and their types
const envSchema = z.object({
  SERVER_PORT: z.coerce.number().default(80),

  ALLOWED_ORIGINS_REGEX: z.string(),
  OIDC_ISSUER_URL: z.url(),
  OIDC_CLIENT_ID: z.string(),
  OIDC_CLIENT_SECRET: z.string(),

  // Not declared in secretspec.toml, since kennel's services support no other
  // env-injection path today, this default is a stopgap until governance
  // actually supplies a real value for the deployed service.
  ADMIN_GROUP: z.string().default(""),

  APP_URL: z.url().default("http://localhost:4173"),

  // Shared ricochet OAuth relay callback. Login uses it as the IdP
  // redirect_uri and puts our real callback in the OAuth `state` (return_to),
  // so preview hosts authenticate without registering a redirect URI.
  OAUTH_RELAY_URL: z.url(),

  DATABASE_URL: z.url(),

  AGENT_API_URL: z.url(),
  AGENT_SHARED_SECRET: z.string().optional(),
});

// Validate `process.env` against our schema and return the result
const env = envSchema.parse(process.env);

// Export the result so we can use it in the project
export { env };
