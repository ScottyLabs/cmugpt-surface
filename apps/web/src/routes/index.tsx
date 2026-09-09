import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/integrations/auth/AuthProvider.tsx";
import { ChatShell } from "@/components/ChatShell.tsx";

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>) => ({
    chat: typeof raw.chat === "string" ? raw.chat : undefined,
    newChat: raw.newChat === true || raw.newChat === "true" || raw.newChat === "1",
  }),
  component: App,
});

// Soft washes of the app's palette behind the sign-in card
function SignInBackdrop() {
  return (
    <div aria-hidden className="signin-backdrop pointer-events-none absolute inset-0" />
  );
}

function SignInPage() {
  const auth = useAuth();

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-white px-4">
      <SignInBackdrop />
      <section
        aria-labelledby="signin-title"
        className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)] sm:p-8"
      >
        <h1
          id="signin-title"
          className="text-2xl font-bold text-neutral-900"
        >
          Welcome to Bark
        </h1>
        <p className="mt-2 font-medium text-neutral-800">
          Please sign in with your CMU credentials to continue.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-neutral-700">
          Bark is available exclusively to the Carnegie Mellon community,
          providing access to real-time campus information and
          community-driven knowledge.
        </p>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => {
              auth.login();
            }}
            className="rounded-full bg-brand-secondary-enabled px-6 py-2.5 font-medium text-fg-neutral-primary transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
          >
            Sign in with CMU credentials
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-neutral-500">
          By using Bark, you agree to{" "}
          <Link
            to="/terms"
            className="underline underline-offset-2 hover:text-neutral-700"
          >
            Terms of Use
          </Link>
        </p>
      </section>
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
