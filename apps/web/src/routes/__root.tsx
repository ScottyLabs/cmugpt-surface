import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackDevtoolsGate } from "@/components/TanStackDevtoolsGate.tsx";

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <TanStackDevtoolsGate />
    </>
  ),
});
