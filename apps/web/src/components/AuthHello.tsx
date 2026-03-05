import { $api } from "@/lib/api/client.ts";

export function AuthHello() {
  const {
    data: helloAuthenticated,
    isLoading: isLoadingAuthenticated,
    error: errorAuthenticated,
    isError: isErrorAuthenticated,
  } = $api.useQuery("get", "/hello/authenticated");

  if (isLoadingAuthenticated) {
    return <div>Loading authenticated hello...</div>;
  }

  if (isErrorAuthenticated) {
    console.error(errorAuthenticated);
    return <div>Error getting authenticated hello: see console</div>;
  }

  return <div>Admin Message: {helloAuthenticated?.message}</div>;
}
