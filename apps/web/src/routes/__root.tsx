import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackDevtoolsGate } from "@/components/TanStackDevtoolsGate.tsx";
import { AuthProviderIntegration } from "@/integrations/auth/AuthProvider.tsx";

export const Route = createRootRoute({
  component: () => (
    <AuthProviderIntegration>
      <Outlet />
      <TanStackDevtoolsGate />
    </AuthProviderIntegration>
  ),
});
