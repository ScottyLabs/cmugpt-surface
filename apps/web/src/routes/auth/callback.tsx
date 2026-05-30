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
    let active = true;
    async function finishSignIn() {
      try {
        await auth.signinRedirectCallback();
        if (active) {
          await navigate({ to: "/" });
        }
      } catch (error) {
        console.error("OIDC callback failed", error);
      }
    }

    void finishSignIn();
    return () => {
      active = false;
    };
  }, [auth, navigate]);

  if (auth.error) {
    return (
      <div className="m-8 text-sm text-red-600">
        Sign in failed: {auth.error.message}
      </div>
    );
  }

  return <div className="m-8 text-sm">Finishing sign in...</div>;
}
