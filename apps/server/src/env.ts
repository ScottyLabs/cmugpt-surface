/** biome-ignore-all lint/style/useNamingConvention: environment variables are in SCREAMING_CASE */
import { z } from "zod";

// Define the schema as an object with all of the env variables and their types
const envSchema = z.object({
  SERVER_PORT: z.coerce.number().default(80),

  ALLOWED_ORIGINS_REGEX: z.string(),
  OIDC_ISSUER_URL: z.url().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  ADMIN_GROUP: z.string().default(""),

  // Public base URL of the app (where the browser reaches it). Used to build the
  // OIDC redirect_uri (`${APP_URL}/api/auth/callback`, or the ricochet
  // `return_to`) and the post-logout redirect. In dev this is the Vite origin
  // (which proxies /api to the server); provided by `scottylabs.ricochet.appUrl`
  // in devenv and by the platform in prod.
  APP_URL: z.url().default("http://localhost:3000"),

  // Shared ricochet OAuth relay callback. When set, login uses it as the IdP
  // redirect_uri and puts our real callback in the OAuth `state` (return_to),
  // so preview hosts authenticate without registering a redirect URI. Unset ->
  // direct redirect to `${APP_URL}/api/auth/callback`.
  OAUTH_RELAY_URL: z.url().optional(),

  DATABASE_URL: z.url(),

  AGENT_API_URL: z.url(),
  AGENT_SHARED_SECRET: z.string().optional(),

  // When set, the server serves the built frontend (SPA) from this directory.
  STATIC_DIR: z.string().optional(),
});

// Validate `process.env` against our schema and return the result
const env = envSchema.parse(process.env);

// Export the result so we can use it in the project
export { env };
