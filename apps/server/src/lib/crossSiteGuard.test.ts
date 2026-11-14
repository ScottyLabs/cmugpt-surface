import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { rejectCrossSiteWrites } from "./crossSiteGuard.ts";

await test("state-changing requests need an allowed or absent Origin", async () => {
  const app = express();
  app.use(rejectCrossSiteWrites((origin) => origin === "https://bark.scottylabs.org"));
  app.all("/chats", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.once("listening", resolve);
  });
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/chats`;
  const status = async (method: string, origin?: string) => {
    const response = await fetch(url, {
      method,
      headers: origin === undefined ? {} : { origin },
    });
    await response.body?.cancel();
    return response.status;
  };
  try {
    assert.equal(await status("POST", "https://evil.example"), 403);
    assert.equal(await status("DELETE", "https://evil.example"), 403);
    assert.equal(await status("POST", "null"), 403);
    assert.equal(await status("POST", "https://bark.scottylabs.org"), 200);
    assert.equal(await status("POST"), 200);
    assert.equal(await status("GET", "https://evil.example"), 200);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  }
});
