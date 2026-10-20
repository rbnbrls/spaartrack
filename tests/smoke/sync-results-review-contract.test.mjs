import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const migrationSource = readFileSync(new URL("database/migrations/0012-sync-result-review.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

const payload = {
  schema_version: "trading212-v1",
  cursor: "review-cursor-001",
  accounts: [{ external_account_id: "review-account-001", account_type: "INVEST", balance: "1250.00", currency_code: "EUR" }],
  positions: [{ external_id: "review-position-001", external_account_id: "review-account-001", provider_symbol: "SYNTH", quantity: "10", market_value: "1250.00", currency_code: "EUR" }],
  activities: [{ external_id: "review-activity-001", external_account_id: "review-account-001", activity_type: "BUY", amount: "100.00", currency_code: "EUR" }],
  dividends: [{ external_id: "review-dividend-001", external_account_id: "review-account-001", amount: "5.00", currency_code: "EUR" }]
};

test("TC-US-0805: sync result review exposes before/after posting categories", () => {
  for (const value of ["/api/v1/sync-results", "sync_result_item", "NEW", "UPDATED", "DUPLICATE", "REJECTED", "ATTENTION", "posting_status", "review_decision", "read_only"]) {
    assert.match(apiSource + schemaSource + migrationSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["sync-results-panel", "sync-results-table", "sync-results-status", "sync-results-evidence", "sync-results-filter"]) assert.match(webSource, new RegExp(value, "i"));
});

test("TC-US-0805-runtime: synthetic sync results are reviewable and posting remains separate", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-sync-review-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic sync review owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const auth = { authorization: `Bearer ${(await login.json()).token}`, ...headers };
  const provider = await (await fetch(`${api}/api/v1/providers`, { method: "POST", headers: auth, body: JSON.stringify({ slug: `sync-review-${suffix.replace(/[^0-9]/g, "").slice(-8)}`, name: "Synthetic review provider", provider_type: "BROKER", auth_mode: "API_KEY", api_version: "v0", status: "ACTIVE", capabilities: [{ capability: "SYNC", supported: true }] }) })).json();
  const connection = await (await fetch(`${api}/api/v1/connections`, { method: "POST", headers: auth, body: JSON.stringify({ provider_slug: provider.slug, display_name: "Synthetic review connection", auth_mode: "API_KEY", vault_path: `local/synthetic/${suffix}`, scopes: ["transactions:read"], accounts: [{ external_account_id: "review-account-001", account_type: "INVEST", name: "Review Invest", base_currency_code: "EUR" }] }) })).json();
  const sync = await fetch(`${api}/api/v1/connections/${connection.id}/sync`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "PROVIDER-001", payload }) });
  assert.equal(sync.status, 200);
  const summary = await sync.json();
  const review = await fetch(`${api}/api/v1/sync-results?connection_id=${connection.id}&sync_run_id=${summary.sync_run_id}`, { headers: { authorization: auth.authorization } });
  assert.equal(review.status, 200);
  const result = await review.json();
  assert.equal(result.read_only, true);
  assert.equal(result.posting_status, "NOT_POSTED");
  assert.deepEqual(result.counts, { new: 4, updated: 0, duplicate: 0, rejected: 0, attention: 0 });
  assert.deepEqual(result.items.map((item) => item.item_type), ["NEW", "NEW", "NEW", "NEW"]);
  assert.ok(result.items.every((item) => item.posting_status === "NOT_POSTED"));
  const decision = await fetch(`${api}/api/v1/sync-results/${result.items[0].id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ review_decision: "ACCEPT" }) });
  assert.equal(decision.status, 200);
  assert.equal((await decision.json()).posting_status, "POSTING_REVIEW");
  const duplicateSync = await fetch(`${api}/api/v1/connections/${connection.id}/sync`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "PROVIDER-001", payload: { ...payload, cursor: "review-cursor-002" } }) });
  assert.equal(duplicateSync.status, 200);
  const duplicateSummary = await duplicateSync.json();
  const duplicateReview = await (await fetch(`${api}/api/v1/sync-results?connection_id=${connection.id}&sync_run_id=${duplicateSummary.sync_run_id}`, { headers: { authorization: auth.authorization } })).json();
  assert.equal(duplicateReview.counts.duplicate, 4);
  assert.equal(duplicateReview.items.every((item) => item.item_type === "DUPLICATE"), true);
  assert.equal((await fetch(`${api}/api/v1/sync-results`)).status, 401);
});
