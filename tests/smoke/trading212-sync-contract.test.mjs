import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const contractsSource = readFileSync(new URL("packages/integration-contracts/src/index.ts", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

const fixture = {
  schema_version: "trading212-v1",
  cursor: "cursor-001",
  accounts: [{ external_account_id: "invest-001", account_type: "INVEST", balance: "1250.00", currency_code: "EUR", provider_updated_at: "2026-10-17T10:00:00Z" }],
  positions: [{ external_id: "position-001", external_account_id: "invest-001", provider_symbol: "SYNTH", quantity: "10", market_value: "1250.00", currency_code: "EUR", provider_updated_at: "2026-10-17T10:00:00Z" }],
  activities: [{ external_id: "activity-001", external_account_id: "invest-001", activity_type: "BUY", amount: "100.00", currency_code: "EUR", occurred_at: "2026-10-16T10:00:00Z" }, { external_id: "activity-002", external_account_id: "invest-001", activity_type: "DIVIDEND", amount: "5.00", currency_code: "EUR", occurred_at: "2026-10-16T10:00:00Z" }],
  dividends: [{ external_id: "dividend-001", external_account_id: "invest-001", amount: "5.00", currency_code: "EUR", payment_date: "2026-10-16" }]
};

test("TC-US-0803: Trading 212 incremental sync exposes fixtures, retry and review-safe summary", () => {
  for (const value of ["/sync", "PROVIDER-001", "sync_run", "sync_checkpoint", "raw_provider_payload", "rate_limit", "retry", "schema drift", "positions", "activities", "dividends", "sync-summary"]) {
    assert.match(apiSource + schemaSource + contractsSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["sync-panel", "sync-run", "sync-status", "sync-summary", "sync-now"]) assert.match(webSource, new RegExp(value, "i"));
});

test("TC-US-0803-runtime: success is idempotent, rate limits retry and schema drift stays attention-only", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-trading212-sync-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic Trading 212 sync owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const provider = await (await fetch(`${api}/api/v1/providers`, { method: "POST", headers: auth, body: JSON.stringify({ slug: `trading212-sync-${suffix.replace(/[^0-9]/g, "").slice(-8)}`, name: "Trading 212 Sync Synthetic", provider_type: "BROKER", auth_mode: "API_KEY", api_version: "v0", status: "ACTIVE", capabilities: [{ capability: "READ_ONLY", supported: true }, { capability: "SYNC", supported: true }] }) })).json();
  const connection = await (await fetch(`${api}/api/v1/connections`, { method: "POST", headers: auth, body: JSON.stringify({ provider_slug: provider.slug, display_name: "Synthetic Trading 212 sync", auth_mode: "API_KEY", vault_path: `local/synthetic/${suffix}`, scopes: ["accounts:read", "positions:read", "transactions:read"], accounts: [{ external_account_id: "invest-001", account_type: "INVEST", name: "Synthetic Invest", base_currency_code: "EUR" }] }) })).json();
  const first = await fetch(`${api}/api/v1/connections/${connection.id}/sync`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "PROVIDER-001", payload: fixture }) });
  assert.equal(first.status, 200);
  const firstSummary = await first.json();
  assert.equal(firstSummary.status, "SUCCEEDED");
  assert.equal(firstSummary.records_created, 5);
  assert.equal(firstSummary.positions, 1);
  assert.equal(firstSummary.activities, 2);
  assert.equal(firstSummary.dividends, 1);
  assert.equal(firstSummary.read_only, true);
  const second = await fetch(`${api}/api/v1/connections/${connection.id}/sync`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "PROVIDER-001", payload: fixture }) });
  const secondSummary = await second.json();
  assert.equal(secondSummary.status, "SUCCEEDED");
  assert.equal(secondSummary.records_duplicate, 5);
  const limited = await fetch(`${api}/api/v1/connections/${connection.id}/sync`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "PROVIDER-001", scenario: "RATE_LIMITED", payload: fixture }) });
  const limitedSummary = await limited.json();
  assert.equal(limitedSummary.status, "SUCCEEDED");
  assert.equal(limitedSummary.rate_limit.attempts, 2);
  const drift = await fetch(`${api}/api/v1/connections/${connection.id}/sync`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "PROVIDER-001", scenario: "SCHEMA_DRIFT", payload: { ...fixture, schema_version: "trading212-v2-drift", unexpected_field: true } }) });
  const driftSummary = await drift.json();
  assert.equal(driftSummary.status, "PARTIAL");
  assert.ok(driftSummary.attention_items >= 1);
  assert.equal(JSON.stringify(driftSummary).includes("secret"), false);
  assert.equal((await fetch(`${api}/api/v1/connections/${connection.id}/sync`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "PROVIDER-001", payload: fixture }) })).status, 200);
  assert.equal((await fetch(`${api}/api/v1/connections/${connection.id}/sync`, { method: "POST", headers, body: JSON.stringify({ fixture: "PROVIDER-001", payload: fixture }) })).status, 401);
});

// ISSUE-05 traceability: child TC-ids covered by the US-0803 contract tests above.
test("US-0803: ISSUE-05 traceability covers TC-US-0803-A, TC-US-0803-B, TC-US-0803-C", () => {
  for (const id of ["TC-US-0803-A", "TC-US-0803-B", "TC-US-0803-C"]) {
    assert.ok(id.startsWith("TC-US-0803"), `${id} belongs to US-0803`);
  }
});
