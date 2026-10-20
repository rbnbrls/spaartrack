import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/addon-sandbox.ts", root), "utf8");
const web = readWebSource();
const migration = readFileSync(new URL("database/migrations/0023-addon-sandbox.sql", root), "utf8");

test("TC-US-1606: addon manifest, grants, secrets, events and assets have a sandbox boundary", () => {
  for (const marker of ["validateAddonManifest", "buildAddonSandboxPlan", "addonSandboxRoute", "addon-manifest-v1", "addon-sandbox-v1", "vault-only", "ledger_access"]) {
    assert.match(api + kernel, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  for (const marker of ["addon_manifest", "addon_sandbox_run", "addon_secret_ref", "addon_event_hook", "addon_asset"]) assert.match(migration, new RegExp(marker));
  for (const marker of ["addon-sandbox-panel", "addon-sandbox-form", "prepare-addon-sandbox", "addon-sandbox-submit", "addon-sandbox-revoke", "addon-sandbox-evidence", "addon-sandbox-v1"]) assert.match(web, new RegExp(marker));
  assert.match(api, /ledger_access:\s*"none"|ledger_untouched/);
});

test("TC-US-1606-A/B runtime: synthetic addon installs, starts, stops and revokes without raw secret or ledger mutation", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.API_URL || "http://localhost:18080").replace(/\/$/, "");
  const email = `synthetic-addon-${Date.now()}@example.test`;
  let response = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Addon" }) });
  assert.equal(response.status, 201);
  response = await fetch(`${base}/api/v1/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(response.status, 201);
  const { token } = await response.json();
  const auth = { "content-type": "application/json", authorization: `Bearer ${token}`, "x-trace-id": "trace-addon-1606", "x-correlation-id": "corr-addon-1606" };
  const manifest = { slug: `synthetic-addon-${Date.now()}`, name: "Synthetic Addon", version: "1.0.0", permissions: ["PORTFOLIO_READ"], entrypoints: { ui: "dist/ui.js", events: ["PORTFOLIO_UPDATED"] }, secrets: [{ name: "market-key", vault_path: "vault://synthetic/addons/market-key" }], assets: [{ path: "assets/logo.svg", content_type: "image/svg+xml", sha256: "a".repeat(64) }] };
  response = await fetch(`${base}/api/v1/addons`, { method: "POST", headers: auth, body: JSON.stringify({ manifest }) });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.calculation_version, "addon-sandbox-v1");
  assert.equal(created.sandbox.status, "STOPPED");
  assert.equal(created.sandbox.ledger_access, "none");
  assert.equal(created.secret_count, 1);
  assert.ok(!JSON.stringify(created).includes("raw-secret"));
  response = await fetch(`${base}/api/v1/addons/${created.id}/sandbox/start`, { method: "POST", headers: auth });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sandbox.status, "RUNNING");
  response = await fetch(`${base}/api/v1/addons/${created.id}/sandbox/stop`, { method: "POST", headers: auth });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sandbox.status, "STOPPED");
  response = await fetch(`${base}/api/v1/addons/${created.id}/revoke`, { method: "POST", headers: auth });
  assert.equal(response.status, 200);
  const revoked = await response.json();
  assert.equal(revoked.status, "REVOKED");
  assert.equal(revoked.grants_revoked, 1);
  assert.equal(revoked.secrets_revoked, 1);
  assert.equal(revoked.ledger_untouched, true);
});
