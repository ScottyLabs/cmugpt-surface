/** biome-ignore-all lint/style/useNamingConvention: environment variables are in SCREAMING_CASE */
import { z } from "zod";

// Define the schema as an object with all of the env variables and their types
const envSchema = z.object({
  SERVER_URL: z.url(),
  SERVER_PORT: z.coerce.number().default(80),

  ALLOWED_ORIGINS_REGEX: z.string(),
  CLERK_SECRET_KEY: z.string(),
  CLERK_ISSUER_URL: z.url(),
  CLERK_PEM_KEY: z.string(),
  CLERK_LOGIN_HOST: z.string().url().optional(),
  ADMIN_GROUP: z.string().default(""),

  DATABASE_URL: z.url(),

  AGENT_API_URL: z.url(),
  AGENT_SHARED_SECRET: z.string().optional(),
});

// Validate `process.env` against our schema and return the result
const env = envSchema.parse(process.env);

const isProduction = [
  process.env["NODE_ENV"],
  process.env["AGENT_ENV"],
  process.env["APP_ENV"],
  process.env["ENVIRONMENT"],
  process.env["SECRETSPEC_PROFILE"],
].some((value) => ["prod", "production"].includes(value?.toLowerCase() ?? ""));

const sharedSecret = env.AGENT_SHARED_SECRET;
if (isProduction && !sharedSecret?.trim()) {
  throw new Error(
    "AGENT_SHARED_SECRET is required in production so the browser-facing server can authenticate to cmugpt-agent.",
  );
}
if (isProduction && sharedSecret !== sharedSecret?.trim()) {
  throw new Error(
    "AGENT_SHARED_SECRET cannot have leading or trailing whitespace.",
  );
}
if (isProduction && (sharedSecret?.length ?? 0) < 32) {
  throw new Error(
    "AGENT_SHARED_SECRET must be at least 32 characters in production.",
  );
}

// Export the result so we can use it in the project
export { env };
