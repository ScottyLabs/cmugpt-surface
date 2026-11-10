import assert from "node:assert/strict";
import { createOriginMatcher, isLoopbackOrigin, siblingWebOrigin } from "./originMatcher.ts";

const production = createOriginMatcher([
  "https://bark.scottylabs.org",
  "https://cmugpt.com/",
  String.raw`^https://cmugpt-surface-web-pr-[0-9]+\.scottylabs\.net$`,
]);

Deno.test("exact origins match only themselves", () => {
  assert.equal(production("https://bark.scottylabs.org"), true);
  assert.equal(production("https://cmugpt.com"), true);
  assert.equal(production("https://bark.scottylabs.org.evil.com"), false);
  assert.equal(production("https://evilbark.scottylabs.org"), false);
  assert.equal(production("http://bark.scottylabs.org"), false);
  assert.equal(production("null"), false);
});

Deno.test("anchored patterns cannot be extended", () => {
  assert.equal(production("https://cmugpt-surface-web-pr-72.scottylabs.net"), true);
  assert.equal(production("https://cmugpt-surface-web-pr-72.scottylabs.net.evil.com"), false);
  assert.equal(production("https://other-web-pr-72.scottylabs.net"), false);
});

Deno.test("permissive or malformed entries fail at construction", () => {
  for (const entry of [".", ".*", "scottylabs\\.org", "^https://x\\.org", "https://x.org/path"]) {
    assert.throws(() => createOriginMatcher([entry]), Error, entry);
  }
  assert.equal(createOriginMatcher(["", " "])("https://bark.scottylabs.org"), false);
});

Deno.test("loopback detection is limited to local hosts", () => {
  assert.equal(isLoopbackOrigin("http://localhost:5173"), true);
  assert.equal(isLoopbackOrigin("http://127.0.0.1:4173"), true);
  assert.equal(isLoopbackOrigin("http://localhost.evil.com"), false);
  assert.equal(isLoopbackOrigin("https://bark.scottylabs.org"), false);
});

Deno.test("the deployment's web origin is derived from its API URL", () => {
  assert.equal(
    siblingWebOrigin("https://cmugpt-surface-api-pr-73.scottylabs.net"),
    "https://cmugpt-surface-web-pr-73.scottylabs.net",
  );
  assert.equal(
    siblingWebOrigin("https://cmugpt-surface-api-fix-api-docs.scottylabs.net/"),
    "https://cmugpt-surface-web-fix-api-docs.scottylabs.net",
  );
  assert.equal(siblingWebOrigin("https://api.cmugpt.com"), null);
  assert.equal(siblingWebOrigin("http://localhost:4173"), null);
  assert.equal(siblingWebOrigin("https://x-api-y.scottylabs.net.evil.com"), null);
  assert.equal(siblingWebOrigin("not a url"), null);
});
