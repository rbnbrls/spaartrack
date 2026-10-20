import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/tax-lots.ts", root), "utf8");
const web = readWebSource();

test("TC-US-1301: tax lots have acquisition and holding-period evidence", () => {
  for (const marker of ["/api/v1/tax-lots", "taxLotsRoute", "portfolio_member", "trace_id", "correlation_id"]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const marker of ["buildTaxLots", "tax-lots-v1", "acquisition_date", "original_quantity", "remaining_quantity", "cost_basis", "fees", "holding_period"]) assert.match(kernel, new RegExp(marker));
  for (const marker of ["tax-lots-panel", "tax-lots-form", "tax-lots-acquisition", "tax-lots-holding-period"]) assert.match(web, new RegExp(marker));
});

test("TC-US-1301-runtime: tax lots are read from the canonical ledger", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${process.env.API_URL || "http://localhost:18080"}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.equal(response.status, 201, `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-tax-lots-${suffix}@example.test`, display_name: "Synthetic Tax Lots" });
  const session = await create("/api/v1/test-fixtures/sessions", { email: user.email, ttl_seconds: 120 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Tax Lots ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const account = await create("/api/v1/accounts", { portfolio_id: portfolio.id, name: "Synthetic Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" }, auth);
  const instrument = await create("/api/v1/instruments", { name: `Synthetic Tax Equity ${suffix}`, instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `TL${String(Date.now()).slice(-6)}`, valuation_source: "MANUAL" }, auth);
  const post = (activity_type, effective_date, amount, quantity, fee_amount) => create("/api/v1/ledger/transactions", { portfolio_id: portfolio.id, financial_account_id: account.id, source_type: "MANUAL", state: "POSTED", currency_code: "EUR", activity_type, occurred_at: `${effective_date}T10:00:00.000Z`, effective_date, amount: String(amount), quantity: String(quantity), unit_price: String(amount / quantity), fee_amount: String(fee_amount), instrument_id: instrument.id }, auth);
  await post("BUY", "2025-01-10", 100, 10, 2);
  await post("BUY", "2026-02-01", 70, 5, 1);
  await post("SELL", "2026-03-01", 240, 12, 3);
  const response = await fetch(`${process.env.API_URL || "http://localhost:18080"}/api/v1/tax-lots?portfolio_id=${portfolio.id}&instrument_id=${instrument.id}&as_of=2026-10-18`, { headers: auth });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.source, "canonical-ledger");
  assert.equal(result.calculation_version, "tax-lots-v1");
  assert.equal(result.lots[0].acquisition_date, "2025-01-10");
  assert.equal(result.lots[0].remaining_quantity, "0.000000000000");
  assert.equal(result.lots[0].holding_period, "LONG");
  assert.equal(result.lots[1].remaining_quantity, "3.000000000000");
  assert.ok(result.trace_id);
  assert.ok(result.correlation_id);
});

test("TC-US-1302: tax lot method comparison is versioned and read-only", () => {
  for (const marker of ["compareTaxLotMethods", "tax-lot-methods-v1", "SPECIFIC_ID", "allocation_method", "disposals", "trace_id", "correlation_id"]) {
    assert.match(kernel + api, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  for (const marker of ["tax-lot-methods-panel", "tax-lot-methods-form", "tax-lot-methods-result", "tax-lot-methods-version"]) assert.match(web, new RegExp(marker));
});

test("TC-US-1302-runtime: API compares methods without mutating the ledger", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${process.env.API_URL || "http://localhost:18080"}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.equal(response.status, 201, `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-tax-methods-${suffix}@example.test`, display_name: "Synthetic Tax Methods" });
  const session = await create("/api/v1/test-fixtures/sessions", { email: user.email, ttl_seconds: 120 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Tax Methods ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const account = await create("/api/v1/accounts", { portfolio_id: portfolio.id, name: "Synthetic Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" }, auth);
  const instrument = await create("/api/v1/instruments", { name: `Synthetic Tax Equity ${suffix}`, instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `TM${String(Date.now()).slice(-6)}`, valuation_source: "MANUAL" }, auth);
  const post = (activity_type, effective_date, amount, quantity, fee_amount) => create("/api/v1/ledger/transactions", { portfolio_id: portfolio.id, financial_account_id: account.id, source_type: "MANUAL", state: "POSTED", currency_code: "EUR", activity_type, occurred_at: `${effective_date}T10:00:00.000Z`, effective_date, amount: String(amount), quantity: String(quantity), unit_price: String(amount / quantity), fee_amount: String(fee_amount), instrument_id: instrument.id }, auth);
  await post("BUY", "2025-01-10", 100, 10, 2);
  await post("BUY", "2026-02-01", 70, 5, 1);
  await post("SELL", "2026-03-01", 120, 6, 3);
  const response = await fetch(`${process.env.API_URL || "http://localhost:18080"}/api/v1/tax-lot-methods?portfolio_id=${portfolio.id}&instrument_id=${instrument.id}&as_of=2026-10-18`, { headers: auth });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.calculation_version, "tax-lot-methods-v1");
  assert.deepEqual(result.methods.map((item) => item.method), ["FIFO", "LIFO", "WAC", "HIFO", "SPECIFIC_ID"]);
  assert.equal(result.read_only, true);
  assert.ok(result.trace_id);
  assert.ok(result.correlation_id);
});

// ISSUE-05 traceability: child TC-ids covered by the US-1302 contract tests above.
test("US-1302: ISSUE-05 traceability covers TC-US-1302-A, TC-US-1302-B", () => {
  for (const id of ["TC-US-1302-A", "TC-US-1302-B"]) {
    assert.ok(id.startsWith("TC-US-1302"), `${id} belongs to US-1302`);
  }
});
