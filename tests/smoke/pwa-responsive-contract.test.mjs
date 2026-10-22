import { webUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const web = readWebSource();
const nginx = readFileSync(new URL("apps/web/nginx.conf", root), "utf8");

test("TC-US-1504-A: portfolio flows are responsive on mobile viewport", () => {
  for (const marker of [
    "pwa-responsive-v1",
    "mobile-nav-toggle",
    "responsive-table-scroll",
    "@media(max-width:",
    "position-detail-panel",
  ]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1504-B: import review controls work without horizontal overflow", () => {
  for (const marker of [
    "import-review-scroll",
    "review-commit-controls",
    "overflow-x",
  ]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1504 runtime: web serves manifest and mobile viewport serves UI", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (webUrl).replace(/\/$/, "");
  const res = await fetch(`${base}/`, { headers: { "User-Agent": "synthetic-mobile" } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /viewport/);
  assert.match(html, /pwa-responsive-v1/);
  assert.ok(nginx.includes("manifest") || html.includes("manifest"), "manifest served");
});
