import type { LazyExoticComponent, ReactElement } from "react";
import { lazy, Suspense } from "react";

let TanStackDevtoolsLazy: LazyExoticComponent<() => ReactElement> | null = null;

if (import.meta.env.DEV) {
  TanStackDevtoolsLazy = lazy(async () => {
    const [{ TanStackDevtools }, { TanStackRouterDevtoolsPanel }] =
      await Promise.all([
        import("@tanstack/react-devtools"),
        import("@tanstack/react-router-devtools"),
      ]);
    return {
      default: () => (
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
      ),
    };
  });
}

/** Dev-only; excluded from production builds so React’s `checkDCE` is not tripped. */
export function TanStackDevtoolsGate() {
  if (!TanStackDevtoolsLazy) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <TanStackDevtoolsLazy />
    </Suspense>
  );
}
