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

  await expect(page.getByText(/Sign in to use cmuGPT/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign In/i })).toBeVisible();
});

test.describe("Authenticated Chat Surface", () => {
  test.beforeEach(async ({ page }) => {
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

    await page.addInitScript(() => {
      const storageKey = "oidc.user:http://127.0.0.1:3000/oidc:client-id";
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          // biome-ignore lint/style/useNamingConvention: OIDC standard field
          access_token: "mock_access_token",
          // biome-ignore lint/style/useNamingConvention: OIDC standard field
          id_token: "mock_id_token",
          profile: {
            sub: "12345",
            name: "Scotty Dog",
            picture: "https://example.com/scotty.png",
          },
          // biome-ignore lint/style/useNamingConvention: OIDC standard field
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
    });
  });

  test("should render the chat interface and handle message inputs", async ({
    page,
  }) => {
    await page.goto("/");

    const inputArea = page.getByPlaceholder(/ask cmugpt/i);
    await expect(inputArea).toBeVisible();

    await inputArea.fill("Hello from the e2e test layer!");
    await inputArea.press("Enter");
  });
});
