import { expect, type Page, type Route, test } from "../../../playwright-test.ts";

test("signed-out users see the login surface", async ({ page }: { page: Page }) => {
  await page.route("**/api/auth/me", async (route: Route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false }),
    });
  });

  await page.goto("/");

  await expect(page.getByText("Sign in to use cmuGPT.")).toBeVisible();

  await page.route("**/api/auth/login**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: "login",
    });
  });

  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL(/\/api\/auth\/login\?returnTo=%2F%3FnewChat%3Dfalse&webOrigin=/u);
});

async function mockMeRoutes(page: Page) {
  await page.route("**/api/auth/me", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        user: {
          sub: "user-123",
          email: "student@example.edu",
          givenName: "Alex",
          groups: ["cmugpt"],
        },
      }),
    });
  });

  await page.route("**/me/models", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        models: [
          {
            id: "gpt-4o-mini",
            label: "GPT-4o Mini",
            description: "Fast default",
          },
        ],
      }),
    });
  });

  await page.route("**/me/preferences", async (route: Route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 204,
        contentType: "application/json",
        body: "",
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ preferredModel: "gpt-4o-mini" }),
    });
  });
}

async function mockAuthenticatedSession(page: Page) {
  await mockMeRoutes(page);

  await page.route("**/chats", async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.continue();
  });
}

test("authenticated users reach the chat shell", async ({ page }: { page: Page }) => {
  await mockAuthenticatedSession(page);

  await page.goto("/");

  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
  await expect(page.getByText("New Chat")).toBeVisible();
  await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
});
