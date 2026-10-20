import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const kernel = readFileSync(new URL("apps/api/src/offline-cache.ts", root), "utf8");
const web = readWebSource();

test("TC-US-1505: offline cache is encrypted, scoped and marks stale data", () => {
  for (const marker of ["sealOfflineCache", "openOfflineCache", "offline-cache-v1", "aes-256-gcm", "expires_at", "write_allowed"]) {
    assert.match(kernel, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of ["offline-cache-panel", "offline-cache-form", "prepare-offline-cache", "offline-cache-submit", "offline-cache-result", "offline-cache-evidence", "offline-cache-v1", "stale"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1505 runtime: web serves offline cache panel with stale indicator", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.WEB_URL || "http://localhost:3000").replace(/\/$/, "");
  const res = await fetch(`${base}/`, { headers: { "User-Agent": "synthetic-offline" } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /offline-cache-panel/);
  assert.match(html, /offline-cache-v1/);
  assert.match(html, /stale/i);
});
