import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "react-oidc-context";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for the AuthProvider to finish processing the signin callback.
    // `react-oidc-context` handles the callback internally (via the
    // AuthProvider onSigninCallback), so we simply wait until the
    // auth provider finishes loading and then navigate to the root.
    let mounted = true;
    if (!auth.isLoading && mounted) {
      if (auth.isAuthenticated) {
        void navigate({ to: "/", search: { chat: undefined, newChat: false } });
      } else if (auth.error) {
        console.error("OIDC callback failed", auth.error);
      }
    }
    return () => {
      mounted = false;
    };
  }, [auth.isLoading, auth.isAuthenticated, auth.error, navigate]);

  if (auth.error) {
    return (
      <div className="m-8 text-sm text-red-600">
        Sign in failed: {auth.error.message}
      </div>
    );
  }

  return <div className="m-8 text-sm">Finishing sign in...</div>;
}
