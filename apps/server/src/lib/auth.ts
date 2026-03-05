import type { Session, User } from "better-auth";
import { betterAuth } from "better-auth";
import { customSession, genericOAuth, keycloak } from "better-auth/plugins";
import jwt from "jsonwebtoken";
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
    customSession(async ({ user, session }, ctx): Promise<Auth> => {
      const customSessionObject: Auth = { session, user };

      // Get the decoded access token from the user
      const decoded = await auth.api
        .getAccessToken({
          body: { providerId: "keycloak" },
          headers: ctx.headers,
        })
        .then((accessToken) => {
          return jwt.decode(accessToken.accessToken);
        });

      // Add groups to the session if they are present in the access token
      if (decoded && typeof decoded === "object" && "groups" in decoded) {
        customSessionObject.user.groups = decoded["groups"];
      }

      return customSessionObject;
    }),
  ],
});
