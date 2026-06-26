import { expect, test } from "@playwright/test";

test("unauthenticated users see the sign-in surface", async ({ page }) => {
  await page.route("**/oidc/**", async (route) => {
    await route.fulfill({
      json: {
        // biome-ignore lint/style/useNamingConvention: OIDC standard field
        authorization_endpoint: "/oidc/auth",
        // biome-ignore lint/style/useNamingConvention: OIDC standard field
        end_session_endpoint: "/oidc/logout",
        issuer: "http://127.0.0.1:3000/oidc",
        // biome-ignore lint/style/useNamingConvention: OIDC standard field
        jwks_uri: "http://127.0.0.1:3000/oidc/jwks",
        // biome-ignore lint/style/useNamingConvention: OIDC standard field
        token_endpoint: "http://127.0.0.1:3000/oidc/token",
        // biome-ignore lint/style/useNamingConvention: OIDC standard field
        userinfo_endpoint: "http://127.0.0.1:3000/oidc/userinfo",
      },
    });
  });

  await page.goto("/");

  await expect(page.getByText("Sign in to use cmuGPT.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});
