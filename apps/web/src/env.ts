/** biome-ignore-all lint/style/useNamingConvention: environment variables are in SCREAMING_CASE */
import { z } from "zod";

// Define the schema as an object with all of the env
// variables and their types
const envSchema = z.object({
  VITE_SERVER_URL: z.url(),
  VITE_OIDC_ISSUER_URL: z.url(),
  VITE_OIDC_CLIENT_ID: z.string(),
  VITE_OIDC_REDIRECT_URI: z.string().optional(),
  VITE_OIDC_POST_LOGOUT_REDIRECT_URI: z.string().optional(),
});

// Validate `process.env` against our schema
// and return the result
const env = envSchema.parse(import.meta.env);

// Export the result so we can use it in the project
export { env };
