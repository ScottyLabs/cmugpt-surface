import type { paths } from "@cmugpt-frontend/server/build/openapi";
import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import { API_BASE_URL } from "./base.ts";

const fetchClient = createFetchClient<paths>({
  baseUrl: API_BASE_URL || "/",
  credentials: "include",
});

// Create the React Query wrapped client
export const $api = createClient(fetchClient);
