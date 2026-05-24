import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import type React from "react";
import { useEffect } from "react";
import { setTokenGetter } from "@/lib/api/client.ts";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

function TokenGetterSetter({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    console.log("🔑 [TokenGetterSetter] Setting token getter from Clerk");
    const wrappedGetToken = async () => {
      try {
        const token = await getToken();
        console.log(
          "✅ [TokenGetterSetter] Token obtained, length:",
          token?.length || 0,
        );
        return token;
      } catch (e) {
        console.error("❌ [TokenGetterSetter] Failed to get Clerk token:", e);
        return null;
      }
    };
    setTokenGetter(wrappedGetToken);
  }, [getToken]);

  return <>{children}</>;
}

export function ClerkProviderIntegration({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <TokenGetterSetter>{children}</TokenGetterSetter>
    </ClerkProvider>
  );
}
