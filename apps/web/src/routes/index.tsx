import { Button } from "@scottylabs/corgi";
import { createFileRoute } from "@tanstack/react-router";
import { ChatShell } from "@/components/ChatShell.tsx";
import { signIn, useSession } from "@/lib/auth/client.ts";

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>) => ({
    chat: typeof raw.chat === "string" ? raw.chat : undefined,
    newChat:
      raw.newChat === true || raw.newChat === "true" || raw.newChat === "1",
  }),
  component: App,
});

function App() {
  const { data: auth } = useSession();

  if (!auth?.user) {
    return (
      <div className="m-8 flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-neutral-600">Sign in to use cmuGPT.</p>
        <Button
          size="md"
          theme="brand"
          className="inline"
          onClick={() => signIn()}
        >
          Sign In
        </Button>
      </div>
    );
  }

  return <ChatShell />;
}
