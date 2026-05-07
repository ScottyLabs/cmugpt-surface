import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackDevtoolsGate } from "@/components/TanStackDevtoolsGate.tsx";
import { ClerkProviderIntegration } from "@/integrations/clerk/provider.tsx";

export const Route = createRootRoute({
  component: () => (
    <ClerkProviderIntegration>
      <Outlet />
      <TanStackDevtoolsGate />
    </ClerkProviderIntegration>
  ),
});
