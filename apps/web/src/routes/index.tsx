import { Button } from "@scottylabs/corgi";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "react-oidc-context";
import { ChatShell } from "@/components/ChatShell.tsx";

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>) => ({
    chat: typeof raw.chat === "string" ? raw.chat : undefined,
    newChat:
      raw.newChat === true || raw.newChat === "true" || raw.newChat === "1",
  }),
  component: App,
});

function SignInPage() {
  const auth = useAuth();

  return (
    <div className="m-8 flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-neutral-600">Sign in to use cmuGPT.</p>
      <Button
        size="md"
        theme="brand"
        className="inline"
        onClick={() => void auth.signinRedirect()}
      >
        Sign In
      </Button>
    </div>
  );
}

export function App() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <div className="m-8 text-sm">Checking your session...</div>;
  }

  return (
    <>
      {!auth.isAuthenticated ? (
        <SignInPage />
      ) : (
        <ChatShell />
      )}
    </>
  );
}
