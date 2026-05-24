import { useAuth, useUser } from "@clerk/clerk-react";

/**
 * Get Clerk session token for API Authorization header (Bearer token)
 * Should be called from a component context
 */
export function useClerkToken() {
  const { getToken } = useAuth();
  return getToken;
}

/**
 * Custom hook to get session data (Clerk-compatible)
 * Returns { data: { user: ClerkUser } | null } to match the interface
 */
export function useSession() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  return {
    data: isSignedIn && user ? { user } : null,
    isLoading: false,
  };
}

/**
 * Export Clerk hooks directly for use in components
 */
export { useAuth, useClerk, useUser } from "@clerk/clerk-react";
