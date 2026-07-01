/** biome-ignore-all lint/style/useNamingConvention: environment variables are in SCREAMING_CASE */
import { z } from "zod";

// Define the schema as an object with all of the env variables and their types
const envSchema = z.object({
  SERVER_URL: z.url(),
  SERVER_PORT: z.coerce.number().default(80),

  ALLOWED_ORIGINS_REGEX: z.string(),
  OIDC_ISSUER_URL: z.url(),
  OIDC_CLIENT_ID: z.string(),
  OIDC_CLIENT_SECRET: z.string(),
  ADMIN_GROUP: z.string().default(""),

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
