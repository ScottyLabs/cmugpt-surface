import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/integrations/auth/AuthProvider.tsx";
import { ChatShell } from "@/components/ChatShell.tsx";

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>) => ({
    chat: typeof raw.chat === "string" ? raw.chat : undefined,
    newChat: raw.newChat === true || raw.newChat === "true" || raw.newChat === "1",
  }),
  component: App,
});

function SignInPage() {
  const auth = useAuth();

  return (
    <div className="m-8 flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-neutral-600">Sign in to use cmuGPT.</p>
      <button
        type="button"
        onClick={() => {
          auth.login();
        }}
        className="inline rounded-full bg-brand-secondary-enabled px-6 py-2 font-medium text-fg-neutral-primary transition-colors hover:brightness-95"
      >
        Sign In
      </button>
    </div>
  );
}

export function App() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <div className="m-8 text-sm">Checking your session...</div>;
  }

  return auth.isAuthenticated ? <ChatShell /> : <SignInPage />;
}
