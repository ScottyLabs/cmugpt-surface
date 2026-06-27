import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackDevtoolsGate } from "@/components/TanStackDevtoolsGate.tsx";
import { OidcProviderIntegration } from "@/integrations/oidc/provider.tsx";

export const Route = createRootRoute({
  component: () => (
    <OidcProviderIntegration>
      <Outlet />
      <TanStackDevtoolsGate />
    </OidcProviderIntegration>
  ),
});
