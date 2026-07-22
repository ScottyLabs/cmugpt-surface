import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/api/base.ts";

// Auth is server-side (BFF). The browser holds only an httpOnly session cookie;
// this provider just reflects "who am I" from /api/auth/me and triggers the
// server's login/logout redirects.

export interface AuthUser {
  sub?: string;
  email?: string;
  givenName?: string;
  groups?: string[];
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProviderIntegration>");
  }
  return ctx;
}

export function AuthProviderIntegration({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<{ user?: AuthUser }>) : null))
      .then((data) => {
        if (active) {
          setUser(data?.user ?? null);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login: () => {
        const returnTo = window.location.pathname + window.location.search;
        const webOrigin = encodeURIComponent(window.location.origin);
        window.location.href = `${API_BASE_URL}/api/auth/login?returnTo=${encodeURIComponent(returnTo)}&webOrigin=${webOrigin}`;
      },
      logout: () => {
        const webOrigin = encodeURIComponent(window.location.origin);
        window.location.href = `${API_BASE_URL}/api/auth/logout?webOrigin=${webOrigin}`;
      },
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
