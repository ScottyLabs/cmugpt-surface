import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";

export function TanstackQueryDevtools() {
  return {
    name: "Tanstack Query",
    render: <ReactQueryDevtoolsPanel />,
  };
}
