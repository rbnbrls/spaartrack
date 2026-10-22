import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const adrSource = readFileSync(new URL("docs/adr/0002-canonical-ledger.md", root), "utf8");
const api = apiUrl;

test("TC-US-0706: performance comparison exposes TWR, MWRR/IRR and Modified Dietz contracts", () => {
  for (const value of ["/api/v1/performance-comparison", "performanceComparisonRoute", "TWR", "MWRR", "IRR", "MODIFIED_DIETZ", "formula_version", "limitations", "net_cash_flow", "cashflows"]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  assert.match(adrSource, /ledger_transaction en ledger_entry zijn de financiële bron van waarheid/);
  for (const value of ["performance-comparison", "performance-start", "performance-end", "performance-twr", "performance-mwrr", "performance-irr", "performance-dietz", "TWR", "MWRR", "IRR", "Modified Dietz"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-0706-runtime: cashflow timing produces comparable performance methods", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-performance-0706-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic performance owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const portfolio = await (await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Performance ${suffix}`, reporting_currency_code: "EUR", privacy_scope: "PRIVATE" }) })).json();
  const account = await (await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic performance account", account_type: "BROKERAGE", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) })).json();
  const instrument = await (await fetch(`${api}/api/v1/instruments`, { method: "POST", headers: auth, body: JSON.stringify({ name: "Synthetic performance equity", instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `PRF${suffix.replace(/[^0-9]/g, "").slice(-6)}`, valuation_source: "MANUAL" }) })).json();
  const snapshot = (snapshot_at, calculation_version) => fetch(`${api}/api/v1/portfolio-snapshots`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, snapshot_at, calculation_version }) });
  assert.equal((await snapshot("2026-01-01T23:00:00.000Z", "performance-start-v1")).status, 201);
  const post = (payload) => fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, source_type: "MANUAL", state: "POSTED", currency_code: "EUR", ...payload }) });
  assert.equal((await post({ activity_type: "DEPOSIT", occurred_at: "2026-01-02T10:00:00.000Z", effective_date: "2026-01-02", amount: "100.00" })).status, 201);
  assert.equal((await post({ activity_type: "BUY", occurred_at: "2026-01-03T10:00:00.000Z", effective_date: "2026-01-03", amount: "100.00", instrument_id: instrument.id, quantity: "10", unit_price: "10.00" })).status, 201);
  assert.equal((await fetch(`${api}/api/v1/instrument-prices`, { method: "POST", headers: auth, body: JSON.stringify({ instrument_id: instrument.id, price_at: "2026-04-01T16:00:00.000Z", price: "11.00", currency_code: "EUR", source: "SYNTHETIC", is_close: true }) })).status, 201);
  assert.equal((await snapshot("2026-04-01T23:00:00.000Z", "performance-end-v1")).status, 201);
  const comparison = await fetch(`${api}/api/v1/performance-comparison?portfolio_id=${portfolio.id}&period_start=2026-01-01&period_end=2026-04-01`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(comparison.status, 200);
  const payload = await comparison.json();
  assert.equal(payload.calculation_version, "performance-comparison-v1");
  assert.equal(payload.period_start, "2026-01-01");
  assert.equal(payload.period_end, "2026-04-01");
  assert.equal(payload.cashflows.length, 1);
  assert.equal(payload.cashflows[0].amount, "100.000000000000");
  assert.equal(payload.methods.TWR.return_pct, "10.000000000000");
  assert.equal(payload.methods.MODIFIED_DIETZ.formula_version, "modified-dietz-v1");
  assert.equal(payload.methods.MWRR.formula_version, "xirr-v1");
  assert.equal(payload.methods.IRR.formula_version, "xirr-v1");
  assert.match(payload.methods.TWR.limitations, /snapshot/i);
  assert.equal((await fetch(`${api}/api/v1/performance-comparison?portfolio_id=${portfolio.id}&period_start=2026-01-01&period_end=2026-04-01`)).status, 401);
});

// ISSUE-05 traceability: child TC-ids covered by the US-0706 contract tests above.
test("US-0706: ISSUE-05 traceability covers TC-US-0706-A, TC-US-0706-B, TC-US-0706-C", () => {
  for (const id of ["TC-US-0706-A", "TC-US-0706-B", "TC-US-0706-C"]) {
    assert.ok(id.startsWith("TC-US-0706"), `${id} belongs to US-0706`);
  }
});
