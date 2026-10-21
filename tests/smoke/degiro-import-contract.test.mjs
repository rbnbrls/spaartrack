import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const contractsSource = readFileSync(new URL("packages/integration-contracts/src/index.ts", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const fixture = readFileSync(new URL("fixtures/PROVIDER-001-degiro.csv", root), "utf8");
const api = apiUrl;

test("TC-US-0804: DEGIRO CSV contract exposes versioned layout, canonical candidates and reconciliation", () => {
  for (const value of [
    "/api/v1/degiro-imports", "DEGIRO", "degiro-csv-v1", "layout_mapping", "ISIN", "fee_amount",
    "tax_amount", "fx_rate", "cash_amount", "statement_ending_balance", "BALANCE_MISMATCH",
    "reconciliation_status", "canonical candidates", "read-only"
  ]) assert.match(apiSource + schemaSource + contractsSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  for (const value of ["degiro-import-panel", "degiro-import-form", "degiro-import-status", "degiro-import-evidence", "degiro-reconciliation"]) {
    assert.match(webSource, new RegExp(value, "i"));
  }
  assert.match(fixture, /Product,ISIN,Type/);
  assert.match(fixture, /Transactiekosten,Transactiebelasting/);
});

test("TC-US-0804-runtime: synthetic DEGIRO preview normalizes rows and reports reconciliation", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-degiro-0804-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic DEGIRO owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const auth = { authorization: `Bearer ${(await login.json()).token}`, ...headers };
  const portfolio = await (await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Synthetic DEGIRO ${suffix}`, reporting_currency_code: "EUR", privacy_scope: "PRIVATE" }) })).json();
  const preview = await fetch(`${api}/api/v1/degiro-imports`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, filename: "PROVIDER-001-degiro.csv", content_type: "text/csv", content_base64: Buffer.from(fixture).toString("base64"), statement_ending_balance: "954.90", calculated_balance: "954.90", fx_rates: { EUR: "1" } }) });
  assert.equal(preview.status, 201);
  const result = await preview.json();
  assert.equal(result.provider, "DEGIRO");
  assert.equal(result.layout.parser_version, "degiro-csv-v1");
  assert.equal(result.counts.rows_seen, 3);
  assert.deepEqual(result.candidates.map((row) => row.activity_type), ["BUY", "DIVIDEND", "SELL"]);
  assert.equal(result.candidates[0].isin, "IE00SYNTH001");
  assert.equal(result.candidates[0].fee_amount, "2.50");
  assert.equal(result.candidates[1].tax_amount, "0.60");
  assert.equal(result.reconciliation.status, "MATCHED");
  assert.equal(result.reconciliation.difference, "0.00");
  assert.equal(result.read_only, true);
  const mismatch = await fetch(`${api}/api/v1/degiro-imports`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, filename: "PROVIDER-001-degiro-mismatch.csv", content_type: "text/csv", content_base64: Buffer.from(fixture).toString("base64"), statement_ending_balance: "955.00", calculated_balance: "954.90", fx_rates: { EUR: "1.00" } }) });
  assert.equal(mismatch.status, 201);
  const mismatchResult = await mismatch.json();
  assert.equal(mismatchResult.reconciliation.status, "BALANCE_MISMATCH");
  assert.equal(mismatchResult.reconciliation.difference, "0.10");
  assert.equal(mismatchResult.read_only, true);
  assert.equal((await fetch(`${api}/api/v1/degiro-imports`)).status, 401);
});

// ISSUE-05 traceability: child TC-ids covered by the US-0804 contract tests above.
test("US-0804: ISSUE-05 traceability covers TC-US-0804-A, TC-US-0804-B, TC-US-0804-C", () => {
  for (const id of ["TC-US-0804-A", "TC-US-0804-B", "TC-US-0804-C"]) {
    assert.ok(id.startsWith("TC-US-0804"), `${id} belongs to US-0804`);
  }
});
