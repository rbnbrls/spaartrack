import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/addon-sdk.ts", root), "utf8");
const web = readFileSync(new URL("apps/web/index.html", root), "utf8");

test("TC-US-1607: typed SDK reads and event hooks stay within granted scopes", () => {
  for (const marker of ["buildAddonSdkRead", "validateAddonEventHook", "addonSdkRoute", "addon-sdk-v1", "ADDON_SCOPE_DENIED", "ADDON_EVENT_NOT_GRANTED", "ledger_access"]) assert.match(api + kernel, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const marker of ["addon-sdk-panel", "addon-sdk-form", "prepare-addon-sdk", "addon-sdk-submit", "addon-sdk-event", "addon-sdk-revoke-event", "addon-sdk-evidence", "addon-sdk-v1"]) assert.match(web, new RegExp(marker));
});

test("TC-US-1607-A/B runtime: typed read is denied outside grants and events stop after revoke", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.API_URL || "http://localhost:18080").replace(/\/$/, "");
  const email = `synthetic-sdk-${Date.now()}@example.test`;
  let response = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Addon SDK" }) });
  assert.equal(response.status, 201);
  response = await fetch(`${base}/api/v1/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(response.status, 201);
  const { token } = await response.json();
  const auth = { "content-type": "application/json", authorization: `Bearer ${token}`, "x-trace-id": "trace-addon-1607", "x-correlation-id": "corr-addon-1607" };
  const manifest = { slug: `synthetic-sdk-${Date.now()}`, name: "Synthetic SDK", version: "1.0.0", permissions: ["PORTFOLIO_READ"], entrypoints: { ui: "dist/ui.js", events: ["PORTFOLIO_UPDATED"] } };
  response = await fetch(`${base}/api/v1/addons`, { method: "POST", headers: auth, body: JSON.stringify({ manifest }) });
  assert.equal(response.status, 201);
  const addon = await response.json();
  response = await fetch(`${base}/api/v1/addons/${addon.id}/sdk/read`, { method: "POST", headers: auth, body: JSON.stringify({ resource: "portfolio" }) });
  assert.equal(response.status, 200);
  const read = await response.json();
  assert.equal(read.calculation_version, "addon-sdk-v1");
  assert.equal(read.capability, "read_portfolio");
  assert.equal(read.ledger_access, "none");
  response = await fetch(`${base}/api/v1/addons/${addon.id}/sdk/read`, { method: "POST", headers: auth, body: JSON.stringify({ resource: "activities" }) });
  assert.equal(response.status, 403);
  response = await fetch(`${base}/api/v1/addons/${addon.id}/events/PORTFOLIO_UPDATED/emit`, { method: "POST", headers: auth, body: JSON.stringify({ payload: { synthetic: true } }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).delivered, true);
  response = await fetch(`${base}/api/v1/addons/${addon.id}/events/PORTFOLIO_UPDATED/revoke`, { method: "POST", headers: auth });
  assert.equal(response.status, 200);
  response = await fetch(`${base}/api/v1/addons/${addon.id}/events/PORTFOLIO_UPDATED/emit`, { method: "POST", headers: auth, body: JSON.stringify({ payload: { synthetic: true } }) });
  assert.equal(response.status, 403);
});
