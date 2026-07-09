// BFF auth endpoints (openid-client under the hood). The server runs the OIDC
// Authorization Code + PKCE flow and keeps tokens in a Postgres session; the
// browser only gets an httpOnly session cookie.
//
// Ricochet: when OAUTH_RELAY_URL is set, the IdP redirect_uri is the shared
// relay and our real callback rides in the OAuth `state` as `return_to`
// (base64url JSON). The relay bounces the code to us. This lets preview hosts
// authenticate without registering their own redirect URI. Mirrors
// ScottyLabs/link-shortener, server-side.
import { type NextFunction, type Request, type Response, Router } from "express";
import { env } from "../env.ts";
import {
  buildAuthorizeUrl,
  createPkce,
  exchangeCode,
  randomNonce,
  randomState,
  refreshTokens,
} from "../lib/oidcClient.ts";
import {
  consumeLoginState,
  createLoginState,
  createSession,
  deleteSession,
  getSession,
  readCookie,
  SESSION_COOKIE,
  updateSessionTokens,
} from "../lib/sessionStore.ts";

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const cookieSecure = env.APP_URL.startsWith("https");

function appCallbackUrl(): string {
  return `${env.APP_URL.replace(/\/$/, "")}/api/auth/callback`;
}

// Only ever return to a local path, never an absolute/protocol-relative URL.
function safeReturnTo(raw: unknown): string {
  return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

function setSessionCookie(res: Response, sid: string): void {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure,
    path: "/",
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export const authRouter: Router = Router();

authRouter.get("/api/auth/login", async (req: Request, res: Response) => {
  const returnTo = safeReturnTo(req.query["returnTo"]);
  const callback = appCallbackUrl();
  const { verifier, challenge } = await createPkce();
  const nonce = randomNonce();

  const relay = env.OAUTH_RELAY_URL;
  // Relay mode: redirect_uri is the relay; our callback rides in `state`.
  const state = relay
    ? Buffer.from(JSON.stringify({ return_to: callback, r: randomState() })).toString("base64url")
    : randomState();
  const redirectUri = relay ?? callback;

  await createLoginState({ state, codeVerifier: verifier, nonce, redirectUri, returnTo });
  res.redirect(await buildAuthorizeUrl({ redirectUri, state, nonce, codeChallenge: challenge }));
});

authRouter.get("/api/auth/callback", async (req: Request, res: Response) => {
  const { error, state } = req.query;
  if (typeof error === "string") {
    res.redirect(`/?login_error=${encodeURIComponent(error)}`);
    return;
  }
  if (typeof state !== "string") {
    res.status(400).send("Missing state");
    return;
  }

  const tx = await consumeLoginState(state);
  if (!tx) {
    res.status(400).send("Unknown or expired login state");
    return;
  }

  try {
    // The token exchange's redirect_uri = the callbackUrl's origin+path, so use
    // the redirect_uri the code was issued for (relay in relay mode) and attach
    // the incoming query (code/state/iss).
    const incoming = new URL(req.originalUrl, env.APP_URL);
    const callbackUrl = new URL(tx.redirectUri);
    callbackUrl.search = incoming.search;

    const { tokens, claims } = await exchangeCode({
      callbackUrl,
      expectedState: state,
      expectedNonce: tx.nonce,
      codeVerifier: tx.codeVerifier,
    });

    const sid = await createSession(claims, tokens);
    setSessionCookie(res, sid);
    res.redirect(tx.returnTo);
  } catch (err) {
    console.error("[auth] callback failed:", err);
    res.redirect("/?login_error=callback");
  }
});

authRouter.get("/api/auth/logout", async (req: Request, res: Response) => {
  // Local logout: drop our session + cookie and return to the app. We don't do
  // RP-initiated (Keycloak end_session) logout because its post_logout_redirect_uri
  // must be registered on the client, and neither the app URL nor the ricochet
  // relay is allowlisted for post-logout (tested). The Keycloak SSO session
  // persists, so a later "Sign in" re-authenticates silently.
  const sid = readCookie(req, SESSION_COOKIE);
  if (sid) {
    await deleteSession(sid);
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.redirect("/");
});

authRouter.get("/api/auth/me", async (req: Request, res: Response) => {
  const sid = readCookie(req, SESSION_COOKIE);
  const session = sid ? await getSession(sid) : null;
  if (!session) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.status(200).json({
    authenticated: true,
    user: {
      sub: session.sub,
      email: session.email ?? undefined,
      givenName: session.givenName ?? undefined,
      groups: session.groups ?? undefined,
    },
  });
});

/**
 * BFF bridge: turn the session into the `Authorization: Bearer <access_token>`
 * the existing tsoa verifier expects. Refreshes the access token if expired.
 * Runs before the API routes; unauthenticated requests pass through and the
 * route's own @Security returns 401.
 */
export async function attachBearerFromSession(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sid = readCookie(req, SESSION_COOKIE);
    if (sid) {
      const session = await getSession(sid);
      if (session) {
        let accessToken = session.accessToken;
        const expMs = session.accessTokenExpiresAt?.getTime();
        if (expMs && expMs < Date.now() + 30_000 && session.refreshToken) {
          const rotated = await refreshTokens(session.refreshToken);
          await updateSessionTokens(session.id, rotated);
          accessToken = rotated.accessToken;
        }
        req.headers.authorization = `Bearer ${accessToken}`;
      }
    }
  } catch (err) {
    console.error("[bff] token bridge failed:", err);
  }
  next();
}
