import type { paths } from "@cmugpt-frontend/server/build/swagger";
import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";

// Same-origin requests carry the httpOnly session cookie; the server bridges it
// to a Bearer for the API. No token handling in the browser. Relative baseUrl
// works in dev (Vite proxy) and prod (the API serves the SPA).
const fetchClient = createFetchClient<paths>({
  baseUrl: "/",
  credentials: "include",
});

// Create the React Query wrapped client
export const $api = createClient(fetchClient);
