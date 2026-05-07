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
});

// Validate `process.env` against our schema and return the result
const env = envSchema.parse(process.env);

// Export the result so we can use it in the project
export { env };
