/** biome-ignore-all lint/style/useNamingConvention: environment variables are in SCREAMING_CASE */
import { z } from "zod";

// Define the schema as an object with all of the env variables and their types
const envSchema = z.object({
  SERVER_URL: z.url(),
  SERVER_PORT: z.coerce.number().default(80),

  ALLOWED_ORIGINS_REGEX: z.string(),
  AUTH_ISSUER: z.url(),
  AUTH_CLIENT_ID: z.string(),
  AUTH_CLIENT_SECRET: z.string(),
  AUTH_JWKS_URI: z.url(),
  BETTER_AUTH_URL: z.url(), // https://www.better-auth.com/docs/installation#set-environment-variables

  DATABASE_URL: z.url(),

  LLM_API_BASE_URL: z.url().default("https://openrouter.ai/api/v1"),
  LLM_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().default("google/gemini-3.1-flash-lite-preview"),
  LLM_HTTP_REFERER: z.url().optional(),
  LLM_APP_NAME: z.string().optional(),
});

// Validate `process.env` against our schema and return the result
const env = envSchema.parse(process.env);

// Export the result so we can use it in the project
export { env };
