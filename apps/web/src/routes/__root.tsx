import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AuthProviderIntegration } from "@/integrations/auth/AuthProvider.tsx";

export const Route = createRootRoute({
  component: () => (
    <AuthProviderIntegration>
      <Outlet />
    </AuthProviderIntegration>
  ),
});
