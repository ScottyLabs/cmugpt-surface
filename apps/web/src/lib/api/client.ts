import type { paths } from "@cmugpt-frontend/server/build/swagger";
import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import { env } from "@/env.ts";

// Store token getter globally
let tokenGetter: (() => Promise<string | null>) | null = null;

export function setTokenGetter(getter: (() => Promise<string | null>) | null) {
  const msg = `🔑 Setting token getter: ${getter ? "set" : "cleared"}`;
  console.log(msg);
  if (typeof window !== "undefined") {
    window.localStorage?.setItem(
      "debug-token-getter",
      `${msg} at ${new Date().toISOString()}`,
    );
  }
  tokenGetter = getter;
}

// Create a custom fetch that injects the token
async function customFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const initWithHeaders: RequestInit = { ...init };

  if (tokenGetter) {
    try {
      const token = await tokenGetter();
      if (token) {
        // When openapi-fetch passes a Request object as `input` with no
        // separate `init`, we must preserve the Request's own headers
        // (which include Content-Type) before merging in Authorization.
        const existingHeaders =
          initWithHeaders.headers ??
          (input instanceof Request ? input.headers : undefined);
        const headers = new Headers(existingHeaders);
        headers.set("Authorization", `Bearer ${token}`);
        initWithHeaders.headers = headers;
      }
    } catch (error) {
      console.error("Error getting token:", error);
    }
  }

  return fetch(input, initWithHeaders);
}

// Create the base fetch client with custom fetch
const fetchClient = createFetchClient<paths>({
  baseUrl: `${env.VITE_SERVER_URL}`,
  credentials: "include",
  fetch: customFetch,
});

// Create the React Query wrapped client
export const $api = createClient(fetchClient);
