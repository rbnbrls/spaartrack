import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const migrationSource = readFileSync(new URL("database/migrations/0013-provider-sync-failures.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

const payload = {
  schema_version: "trading212-v1",
  cursor: "failure-cursor-001",
  accounts: [{ external_account_id: "failure-account-001", account_type: "INVEST", balance: "100.00", currency_code: "EUR" }],
  positions: [],
  activities: [],
  dividends: []
};

test("TC-US-0806: provider sync failures expose status, retry policy and incident evidence", () => {
  for (const value of ["incident", "incident_event", "PROVIDER_UNAUTHORIZED", "PROVIDER_FORBIDDEN", "PROVIDER_RATE_LIMITED", "PROVIDER_SCHEMA_FAILURE", "retry_policy", "provider_status_code", "incident_id"]) {
    assert.match(apiSource + schemaSource + migrationSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["sync-scenario", "sync-incident", "retry policy", "incident evidence"]) assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
});

test("TC-US-0806-runtime: synthetic 401/403/429/schema failures persist incidents and retry policy", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-sync-failures-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic sync failure owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/sessions`, { method: "POST", headers, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const auth = { authorization: `Bearer ${(await login.json()).token}`, ...headers };
  const provider = await (await fetch(`${api}/api/v1/providers`, { method: "POST", headers: auth, body: JSON.stringify({ slug: `sync-failure-${suffix.replace(/[^0-9]/g, "").slice(-8)}`, name: "Synthetic failure provider", provider_type: "BROKER", auth_mode: "API_KEY", api_version: "v0", status: "ACTIVE", capabilities: [{ capability: "SYNC", supported: true }] }) })).json();
  const connection = await (await fetch(`${api}/api/v1/connections`, { method: "POST", headers: auth, body: JSON.stringify({ provider_slug: provider.slug, display_name: "Synthetic failure connection", auth_mode: "API_KEY", vault_path: `local/synthetic/${suffix}`, scopes: ["transactions:read"], accounts: [{ external_account_id: "failure-account-001", account_type: "INVEST", name: "Failure Invest", base_currency_code: "EUR" }] }) })).json();

  const scenarios = [
    ["AUTH_401", "PROVIDER_UNAUTHORIZED", 401, false],
    ["AUTH_403", "PROVIDER_FORBIDDEN", 403, false],
    ["PROVIDER_429", "PROVIDER_RATE_LIMITED", 429, true],
    ["SCHEMA_FAILURE", "PROVIDER_SCHEMA_FAILURE", 422, false]
  ];
  for (const [scenario, errorCode, providerStatusCode, retryable] of scenarios) {
    const response = await fetch(`${api}/api/v1/connections/${connection.id}/sync`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "PROVIDER-001", scenario, payload: { ...payload, cursor: `${payload.cursor}-${scenario}` } }) });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.status, "FAILED");
    assert.equal(result.error_code, errorCode);
    assert.equal(result.provider_status_code, providerStatusCode);
    assert.equal(result.retry_policy.retryable, retryable);
    assert.ok(result.sync_run_id);
    assert.ok(result.incident_id);
    assert.equal(result.read_only, true);
    assert.ok(result.trace_id);
    assert.ok(result.correlation_id);
  }

  const incidents = await fetch(`${api}/api/v1/sync-incidents?connection_id=${connection.id}`, { headers: { authorization: auth.authorization } });
  assert.equal(incidents.status, 200);
  const incidentBody = await incidents.json();
  assert.equal(incidentBody.incidents.length, 4);
  assert.deepEqual(incidentBody.incidents.map((item) => item.error_code), ["PROVIDER_UNAUTHORIZED", "PROVIDER_FORBIDDEN", "PROVIDER_RATE_LIMITED", "PROVIDER_SCHEMA_FAILURE"]);
  assert.ok(incidentBody.incidents.every((item) => item.evidence?.retry_policy && item.evidence?.provider_status_code && item.events?.length));
  assert.equal((await fetch(`${api}/api/v1/sync-incidents?connection_id=${connection.id}`)).status, 401);
});
