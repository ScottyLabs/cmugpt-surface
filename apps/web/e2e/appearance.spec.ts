import type { components } from "@cmugpt-frontend/server/build/openapi";
import { expect, type Page, type Route, test } from "../../../playwright-test.ts";

// Synthetic data only: exercise UI states without changing real chats or memories.
const chat = { id: "visual-chat", title: "Campus guide", starred: false, isPublic: false, updatedAt: "2026-10-24T12:00:00Z" };
const memories = [
  { id: "one", type: "learned", text: "Prefers vegetarian food", createdAt: chat.updatedAt },
  { id: "two", type: "remembered", text: "Studying computer science", createdAt: chat.updatedAt },
];
const markdown = "## Campus guide\n\n**Important details** and [official information](https://www.cmu.edu).\n\n> Check opening hours before visiting.\n\n- First item\n- Second item\n\nInline `code` and math $x^2 + y^2$.\n\n```python\nprint('A code example with a deliberately long line that should scroll inside its own container')\n```\n\n| Place | Hours |\n| --- | --- |\n| Library | 9–5 |\n\n---\n\nA final paragraph.";
const messages: components["schemas"]["MessageDto"][] = [
  { id: "u", role: "user", content: "Show me campus information and `code`", createdAt: chat.updatedAt },
  { id: "a", role: "assistant", content: markdown, createdAt: chat.updatedAt, confidence: 0.3, savedMemory: { id: "one", kind: "learned", fact: "Prefers vegetarian food" } },
];

async function setup(page: Page) {
  const state = { signedIn: true, owner: true, public: false, memoryError: false, deleteError: false, modelsError: false, modelsEmpty: false, modelsWait: Promise.resolve(), deleteWait: Promise.resolve(), list: [...memories], messageList: [...messages], searchWait: Promise.resolve(), memoryWait: Promise.resolve(), messageWait: Promise.resolve(), streamWait: Promise.resolve() };
  await page.route(/\/(api\/auth\/me|me\/|chats(?:[/?]|$))/, async (route: Route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const send = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/api/auth/me") return send(state.signedIn ? { authenticated: true, user: { sub: "visual-user", givenName: "Alex", email: "student@example.edu", groups: ["cmugpt"] } } : { authenticated: false }, state.signedIn ? 200 : 401);
    if (url.pathname === "/me/models") {
      await state.modelsWait;
      if (state.modelsError) return send({ message: "Models unavailable" }, 500);
      return send({ models: state.modelsEmpty ? [] : [{ id: "one", label: "Fast model" }, { id: "two", label: "Reasoning model" }] });
    }
    if (url.pathname === "/me/preferences") return method === "PATCH" ? route.fulfill({ status: 204 }) : send({ preferredModel: "one" });
    if (url.pathname.startsWith("/me/memories")) {
      if (method === "DELETE") {
        await state.deleteWait;
        if (state.deleteError) return send({ message: "Test deletion failure" }, 500);
        state.list = url.pathname === "/me/memories" ? [] : state.list.filter((item) => !url.pathname.endsWith(item.id));
        return route.fulfill({ status: 204 });
      }
      await state.memoryWait;
      if (state.memoryError) return send({ message: "Test memory outage" }, 500);
      const items = state.list.filter((item) => (!url.searchParams.get("q") || item.text.includes(url.searchParams.get("q")!)) && (!url.searchParams.get("kind") || item.type === url.searchParams.get("kind")));
      const offset = Number(url.searchParams.get("offset") ?? 0);
      return send({ items: items.slice(offset, offset + 200), total: items.length, limit: 200, offset });
    }
    if (url.pathname === "/chats") {
      if (method === "POST") return send(chat);
      if (url.searchParams.has("q")) await state.searchWait;
      return send(url.searchParams.get("q") === "missing" ? [] : [chat, { ...chat, id: "starred", title: "Starred conversation", starred: true }]);
    }
    if (url.pathname.endsWith("/messages/stream")) {
      await state.streamWait;
      return send({ message: "The test service is temporarily unavailable." }, 503);
    }
    if (url.pathname.endsWith("/messages")) { await state.messageWait; return send(state.messageList); }
    if (method === "PATCH") { state.public = Boolean(route.request().postDataJSON()?.isPublic); return send({ ...chat, isPublic: state.public }); }
    return send({ ...chat, isOwner: state.owner, isPublic: state.public });
  });
  return state;
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}
async function sidebar(page: Page) {
  await expect(page.getByRole("complementary")).toBeAttached();
  const region = page.viewportSize()!.width < 768 ? page.getByRole("main") : page.getByRole("complementary");
  const open = region.getByRole("button", { name: "Open sidebar", exact: true });
  if (await open.isVisible()) await open.click();
}
async function menu(page: Page, entry: string) {
  await sidebar(page);
  await page.getByRole("button", { name: /Alex student@example.edu/u }).click();
  await page.getByRole("button", { name: entry, exact: true }).click();
}
async function shot(page: Page, info: { outputPath: (name: string) => string }, name: string) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`${name}.png`), animations: "disabled" });
}

for (const colorScheme of ["light", "dark"] as const) {
  for (const [size, viewport] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]] as const) {
    test.describe(`${colorScheme} ${size}`, () => {
      test.use({ colorScheme, viewport, contextOptions: { reducedMotion: "reduce" } });
      test("sign-in, keyboard focus, terms", async ({ page }: { page: Page }, info) => {
        const state = await setup(page); state.signedIn = false;
        await page.goto("/");
        await expect(page.getByRole("heading", { name: "Welcome to Bark" })).toBeVisible();
        await page.keyboard.press("Tab");
        await shot(page, info, "sign-in-focus");
        await page.getByRole("link", { name: "Terms of Use" }).click();
        await expect(page.getByRole("heading", { name: "Terms of Use" })).toBeVisible();
        await shot(page, info, "terms");
      });
      test("welcome, sidebar, settings, tools, model picker, about", async ({ page }: { page: Page }, info) => {
        await setup(page); await page.goto("/?newChat=true");
        await expect(page.getByRole("heading", { name: /Alex/u })).toBeVisible();
        await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
        await shot(page, info, "welcome");
        await sidebar(page);
        await expect(page.getByRole("complementary")).toHaveCSS("background-color", colorScheme === "dark" ? "rgb(32, 37, 48)" : "rgb(231, 245, 250)");
        await page.getByRole("button", { name: "Campus guide", exact: true }).hover();
        await shot(page, info, "sidebar-hover");
        await page.getByRole("button", { name: "Campus guide", exact: true }).click({ button: "right" });
        await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
        await shot(page, info, "chat-context-menu");
        await page.getByRole("menuitem", { name: "Rename" }).click();
        await expect(page.getByRole("textbox", { name: "Chat name" })).toBeVisible();
        await shot(page, info, "chat-rename"); await page.keyboard.press("Escape");
        await menu(page, "Settings");
        await expect(page.getByRole("combobox", { name: "Appearance" })).toBeVisible();
        for (const tool of ["CMUMaps", "CMUCourses", "CMUEats", "CMUGuide"]) {
          const button = page.getByRole("button", { name: new RegExp(`${tool} On`, "iu") });
          await button.click();
        }
        await shot(page, info, "settings-tools-off");
        for (const tool of ["CMUMaps", "CMUCourses", "CMUEats", "CMUGuide"]) {
          await page.getByRole("button", { name: new RegExp(`${tool} Off`, "iu") }).click();
        }
        if (colorScheme === "dark") {
          await expect(page.getByRole("button", { name: /CMUMaps On/iu }).getByText("On", { exact: true })).toHaveCSS("background-color", "rgb(32, 37, 48)");
        }
        await shot(page, info, "settings-tools-on");
        await page.keyboard.press("Escape"); await menu(page, "About");
        await expect(page.getByRole("heading", { name: "About Bark" })).toBeVisible();
        await shot(page, info, "about"); await page.keyboard.press("Escape");
        await sidebar(page); await page.getByRole("button", { name: "Collapse sidebar" }).click();
        await shot(page, info, "collapsed-sidebar");
        await page.getByRole("textbox", { name: "Message Bark" }).fill("A multiline message\nwith a second line and a long draft to check wrapping on small screens.");
        await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
        await page.getByRole("button", { name: "Fast", exact: true }).click();
        await expect(page.getByRole("button", { name: /Reasoning/u })).toBeVisible();
        await shot(page, info, "multiline-model-picker");
        await page.getByRole("button", { name: /Reasoning/u }).click();
      });
      test("search empty, loading, no results, results", async ({ page }: { page: Page }, info) => {
        const state = await setup(page); await page.goto("/?newChat=true");
        await sidebar(page); await page.getByRole("button", { name: "Search chats", exact: true }).click();
        await expect(page.getByText("Try Searching something!")).toBeVisible();
        await shot(page, info, "search-empty");
        const pending = gate(); state.searchWait = pending.promise;
        await page.getByPlaceholder("Search Chat History").fill("missing");
        await expect(page.getByText("Searching...", { exact: true })).toBeVisible();
        await shot(page, info, "search-loading"); pending.release();
        await expect(page.getByText("Results not found")).toBeVisible();
        await shot(page, info, "search-no-results");
        await page.getByPlaceholder("Search Chat History").fill("Campus");
        await expect(page.getByRole("button", { name: "Start a new chat" })).toBeVisible();
        await shot(page, info, "search-results");
      });
      test("markdown, warning, memory chip, read-only chat", async ({ page }: { page: Page }, info) => {
        const state = await setup(page); await page.goto("/?chat=visual-chat");
        await expect(page.getByRole("heading", { name: "Campus guide" })).toBeVisible();
        await expect(page.getByText("Low confidence:", { exact: false })).toBeVisible();
        await shot(page, info, "markdown");
        await page.getByRole("button", { name: /^Memory saved:/u }).click();
        await expect(page.getByRole("menu", { name: "Memory options" })).toBeVisible();
        await shot(page, info, "memory-chip-menu");
        await page.getByRole("menuitem", { name: "Delete memory" }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await shot(page, info, "memory-chip-confirm");
        state.deleteError = true;
        await page.getByRole("button", { name: "Confirm", exact: true }).click();
        await expect(page.getByText("That memory could not be deleted. Try again.")).toBeVisible();
        await shot(page, info, "memory-chip-error");
        state.owner = false; await page.reload();
        await expect(page.getByRole("textbox", { name: "Message Bark" })).toBeDisabled();
        await shot(page, info, "read-only-chat");
      });
      test("memory loading, filters, empty, confirmations, errors, recovery", async ({ page }: { page: Page }, info) => {
        const state = await setup(page); const pending = gate(); state.memoryWait = pending.promise;
        await page.goto("/?newChat=true"); await menu(page, "Memories");
        await expect(page.getByText("Loading memories...")).toBeVisible();
        await shot(page, info, "memory-loading"); pending.release();
        await expect(page.getByText("Prefers vegetarian food", { exact: true })).toBeVisible();
        await shot(page, info, "memory-list");
        await page.getByRole("button", { name: "Remembered", exact: true }).click();
        await expect(page.getByText("Prefers vegetarian food", { exact: true })).not.toBeVisible();
        await shot(page, info, "memory-filter");
        await page.getByRole("searchbox", { name: "Search memories" }).fill("missing");
        await expect(page.getByText("No matching memories")).toBeVisible();
        await shot(page, info, "memory-no-matches");
        await page.getByRole("searchbox", { name: "Search memories" }).fill("");
        await page.getByRole("button", { name: "All", exact: true }).click();
        await page.getByRole("button", { name: "Delete learned from chats memory" }).click();
        await expect(page.getByRole("alertdialog", { name: "Delete this memory?" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
        await shot(page, info, "memory-delete-confirm");
        state.deleteError = true; await page.getByRole("button", { name: "Confirm", exact: true }).click();
        await expect(page.getByText("That memory could not be deleted. Please try again.")).toBeVisible();
        await shot(page, info, "memory-delete-error");
        state.deleteError = false;
        const deletion = gate(); state.deleteWait = deletion.promise;
        await page.getByRole("button", { name: "Delete learned from chats memory" }).click();
        await page.getByRole("button", { name: "Confirm", exact: true }).click();
        await expect(page.getByRole("button", { name: "Clear all", exact: true })).toBeDisabled();
        await shot(page, info, "memory-deleting"); deletion.release();
        await expect(page.getByText("Memory deleted.", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Clear all", exact: true }).click();
        await expect(page.getByRole("alertdialog", { name: "Clear all memories?" })).toBeVisible();
        await shot(page, info, "memory-clear-confirm");
        await page.getByRole("button", { name: "Confirm", exact: true }).click();
        await expect(page.getByText("No memories yet")).toBeVisible();
        await shot(page, info, "memory-empty");
      });
      test("message loading, thinking, send failure, public chat", async ({ page }: { page: Page }, info) => {
        const state = await setup(page); const pending = gate(); state.messageWait = pending.promise;
        await page.goto("/?chat=visual-chat");
        await expect(page.getByText("Loading messages...")).toBeVisible();
        await shot(page, info, "messages-loading"); pending.release();
        await expect(page.getByRole("heading", { name: "Campus guide" })).toBeVisible();
        const stream = gate(); state.streamWait = stream.promise;
        await page.getByRole("textbox", { name: "Message Bark" }).fill("A test question");
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await expect(page.getByText("Thinking", { exact: false }).last()).toBeVisible();
        await expect(page.getByRole("textbox", { name: "Message Bark" })).toBeDisabled();
        await shot(page, info, "thinking-disabled"); stream.release();
        await expect(page.getByText(/The test service is temporarily unavailable/u)).toBeVisible();
        await shot(page, info, "send-error");
        state.public = true; await page.reload();
        await expect(page.getByRole("button", { name: "Make chat private" })).toBeVisible();
        await shot(page, info, "public-chat");
      });
      test("model loading, empty, failure", async ({ page }: { page: Page }, info) => {
        const state = await setup(page); const pending = gate(); state.modelsWait = pending.promise;
        await page.goto("/?newChat=true");
        await expect(page.getByRole("button", { name: "Loading...", exact: true })).toBeVisible();
        await shot(page, info, "model-loading"); state.modelsEmpty = true; pending.release();
        await expect(page.getByRole("button", { name: "Loading...", exact: true })).toBeVisible();
        await shot(page, info, "model-empty");
        state.modelsError = true; await page.reload();
        await expect(page.getByRole("button", { name: "Loading...", exact: true })).toBeVisible({ timeout: 15000 });
        await shot(page, info, "model-error");
      });
      test("memory pagination", async ({ page }: { page: Page }, info) => {
        const state = await setup(page);
        state.list = Array.from({ length: 201 }, (_, i) => ({ ...memories[0], id: String(i), text: `Memory ${i + 1}` }));
        await page.goto("/?newChat=true"); await menu(page, "Memories");
        await page.getByRole("button", { name: "Load more", exact: true }).click();
        await expect(page.getByText("Showing 201 of 201 memories")).toBeVisible();
        await expect(page.getByRole("button", { name: "Load more", exact: true })).toHaveCount(0);
        await shot(page, info, "memory-pagination");
      });
      test("streamed text and map frame", async ({ page }: { page: Page }, info) => {
        const state = await setup(page);
        await page.route("https://maps.scottylabs.org/**", (route: Route) => route.fulfill({ contentType: "text/html", body: '<html style="color-scheme: light dark"><body style="margin:24px;font:20px sans-serif">Campus map fixture</body></html>' }));
        await page.addInitScript(() => {
          const original = window.fetch;
          window.fetch = (...args) => {
            if (!String(args[0]).endsWith("/messages/stream")) return original(...args);
            return Promise.resolve(new Response(new ReadableStream({ start(controller) {
              const send = (event: unknown) => controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
              send({ type: "delta", text: "A partial **streamed answer**." });
              window.addEventListener("visual-stream-done", () => { send({ type: "done", message: {} }); controller.close(); }, { once: true });
            } }), { headers: { "Content-Type": "application/x-ndjson" } }));
          };
        });
        await page.goto("/?chat=visual-chat");
        await expect(page.getByRole("heading", { name: "Campus guide" })).toBeVisible();
        await page.getByRole("textbox", { name: "Message Bark" }).fill("Show a map");
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await expect(page.getByText("streamed answer", { exact: true })).toBeVisible();
        await shot(page, info, "streaming-text");
        const mapped = { ...messages[1], content: "Gates Hillman Center.", savedMemory: null, cmuMaps: { url: "https://maps.scottylabs.org/GHC", mode: "building", target: "GHC", targetLabel: "Gates Hillman", src: null, srcLabel: null, dest: null, destLabel: null } };
        state.messageList = [messages[0], mapped];
        await page.evaluate(() => window.dispatchEvent(new Event("visual-stream-done")));
        await expect(page.getByRole("button", { name: "Reload map" })).toBeVisible();
        await expect(page.getByRole("textbox", { name: "Message Bark" })).toBeEnabled();
        await shot(page, info, "completed-map");
      });
      test("memory service error and retry", async ({ page }: { page: Page }, info) => {
        const state = await setup(page); state.memoryError = true;
        await page.goto("/?newChat=true"); await menu(page, "Memories");
        await expect(page.getByText("Memories could not be loaded.")).toBeVisible({ timeout: 15000 });
        await shot(page, info, "memory-service-error");
        state.memoryError = false; await page.getByRole("button", { name: "Try again" }).click();
        await expect(page.getByText("Prefers vegetarian food", { exact: true })).toBeVisible();
      });
    });
  }
}

test("appearance follows the system and remembers an override", async ({ page }: { page: Page }) => {
  await setup(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/?newChat=true");
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(23, 23, 23)");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(255, 255, 255)");

  await page.getByRole("button", { name: /Alex/u }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("combobox", { name: "Appearance" }).selectOption("dark");
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(23, 23, 23)");
  await page.reload();
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(23, 23, 23)");

  await page.getByRole("button", { name: /Alex/u }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const appearance = page.getByRole("combobox", { name: "Appearance" });
  await expect(appearance).toHaveValue("dark");
  await appearance.selectOption("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await appearance.selectOption("system");
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(23, 23, 23)");
});
