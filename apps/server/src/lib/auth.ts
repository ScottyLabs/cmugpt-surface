import type { Session, User } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession, genericOAuth, keycloak } from "better-auth/plugins";
import jwt from "jsonwebtoken";
import { db } from "../db/index.ts";
import { account, session, user, verification } from "../db/schema.ts";
import { env } from "../env.ts";

/**
 * Custom session type
 *
 * Used by the frontend client.
 */
interface Auth {
  session: Session;
  user: User & { groups?: string[] };
}

// https://www.better-auth.com/docs/installation#create-a-better-auth-instance
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  // biome-ignore lint/style/useNamingConvention: defined by better-auth
  baseURL: env.SERVER_URL,
  trustedOrigins: [env.BETTER_AUTH_URL],

  plugins: [
    // https://www.better-auth.com/docs/plugins/generic-oauth#pre-configured-provider-helpers
    genericOAuth({
      config: [
        keycloak({
          clientId: env.AUTH_CLIENT_ID,
          clientSecret: env.AUTH_CLIENT_SECRET,
          issuer: env.AUTH_ISSUER,
          // biome-ignore lint/style/useNamingConvention: defined by better-auth
          redirectURI: `${env.SERVER_URL}/api/auth/oauth2/callback/keycloak`,
          scopes: ["openid", "email", "profile", "offline_access"],
        }),
      ],
    }),

    // https://www.better-auth.com/docs/concepts/session-management#customizing-session-response
    customSession(
      async (
        { user: sessionUser, session: sessionData },
        ctx,
      ): Promise<Auth> => {
        const customSessionObject: Auth = {
          session: sessionData,
          user: sessionUser,
        };

        try {
          const accessToken = await auth.api.getAccessToken({
            body: { providerId: "keycloak" },
            headers: ctx.headers,
          });
          const decoded = jwt.decode(accessToken.accessToken);
          if (decoded && typeof decoded === "object" && "groups" in decoded) {
            customSessionObject.user.groups = decoded["groups"];
          }
        } catch (error) {
          // Session is still valid without a Keycloak access token (e.g. refresh expired).
          console.warn(
            "[auth] customSession: getAccessToken failed; continuing without groups",
            error instanceof Error ? error.message : error,
          );
        }

        return customSessionObject;
      },
    ),
  ],
});
