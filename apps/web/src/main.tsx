import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDom from "react-dom/client";
import * as TanStackQueryProvider from "./integrations/tanstack-query/root-provider.tsx";
import { MAINTENANCE_MODE, MAINTENANCE_PAGE } from "./maintenance.ts";
import { reportWebVitals } from "./reportWebVitals.ts";
import "./styles.css";

// Import the generated route tree
import { routeTree } from "./routeTree.gen.ts";

// Maintenance short-circuit. Start the redirect before any app setup runs: the
// navigation is queued immediately, so a later failure (router construction, a
// bad route tree) can no longer stop visitors from seeing the notice.
if (MAINTENANCE_MODE) {
  globalThis.location.replace(MAINTENANCE_PAGE);
}

// Create a new router instance
const TanStackQueryProviderContext = TanStackQueryProvider.getContext();
const router = createRouter({
  routeTree,
  context: {
    ...TanStackQueryProviderContext,
  },
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
if (!MAINTENANCE_MODE) {
  // Render app
  const rootElement = document.querySelector("#app");
  if (rootElement && !rootElement.innerHTML) {
    const root = ReactDom.createRoot(rootElement);
    root.render(
      <StrictMode>
        <TanStackQueryProvider.Provider {...TanStackQueryProviderContext}>
          <RouterProvider router={router} />
        </TanStackQueryProvider.Provider>
      </StrictMode>,
    );
  }

  // If you want to start measuring performance in your app, pass a function
  // to log results (for example: reportWebVitals(console.log))
  // or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
  reportWebVitals();
}
