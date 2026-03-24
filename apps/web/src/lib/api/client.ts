import type { paths } from "@cmugpt-frontend/server/build/swagger";
import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import { env } from "@/env.ts";
import { getKeycloakAccessTokenForApi } from "@/lib/auth/client.ts";

const fetchClient = createFetchClient<paths>({
  baseUrl: `${env.VITE_SERVER_URL}`,
  credentials: "include",
});

fetchClient.use({
  async onRequest({ request }) {
    const token = await getKeycloakAccessTokenForApi();
    if (!token) {
      return undefined;
    }
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return new Request(request, { headers });
  },
});

const $api = createClient(fetchClient);

export { $api };
