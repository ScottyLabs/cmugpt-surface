import type React from "react";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "react-oidc-context";
import { env } from "@/env.ts";
import { setTokenGetter } from "@/lib/api/client.ts";

function resolveOrigin(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.origin;
}

function buildRedirectUri(origin: string): string {
  if (env.VITE_OIDC_REDIRECT_URI) {
    return env.VITE_OIDC_REDIRECT_URI;
  }
  if (!origin) {
    return "";
  }
  return `${origin}/auth/callback`;
}

function TokenGetterSetter({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.access_token) {
      setTokenGetter(null);
      return;
    }

    setTokenGetter(async () => user.access_token ?? null);
  }, [user?.access_token]);

  return <>{children}</>;
}

export function OidcProviderIntegration({ children }: { children: React.ReactNode }) {
  const origin = resolveOrigin();
  const redirectUri = buildRedirectUri(origin);

  if (!redirectUri) {
    throw new Error("Missing VITE_OIDC_REDIRECT_URI (or window.location is unavailable)");
  }

  const authority = env.VITE_OIDC_ISSUER_URL.replace(/\/$/, "");

  return (
    <AuthProvider
      authority={authority}
      client_id={env.VITE_OIDC_CLIENT_ID}
      redirect_uri={redirectUri}
      post_logout_redirect_uri={origin}
      response_type="code"
      scope="openid profile email"
      onSigninCallback={() => {
        if (typeof window !== "undefined") {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }}
    >
      <TokenGetterSetter>{children}</TokenGetterSetter>
    </AuthProvider>
  );
}
