import { $api } from "@/lib/api/client.ts";

export function Hello() {
  const {
    data: hello,
    isLoading,
    error,
    isError,
  } = $api.useQuery("get", "/hello");

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isError) {
    console.error(error);
    return <div>Error: {error}</div>;
  }

  return <div>Authenticated Message: {hello?.message}</div>;
}
