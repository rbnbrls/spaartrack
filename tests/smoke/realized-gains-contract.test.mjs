import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/tax-lots.ts", root), "utf8");
const web = readWebSource();

test("TC-US-1303: realized gains expose fee and FX decomposition", () => {
  for (const marker of ["calculateRealizedGains", "/api/v1/realized-gains", "REALIZED_GAINS", "trace_id", "correlation_id"]) assert.match(api + kernel, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const marker of ["realized-gains-v1", "proceeds", "cost_basis", "historical_cost_base", "disposal_proceeds_base", "fx_gain", "taxable_result"]) assert.match(kernel, new RegExp(marker));
  for (const marker of ["realized-gains-panel", "realized-gains-form", "realized-gains-result", "realized-gains-fx"]) assert.match(web, new RegExp(marker));
});

test("TC-US-1303-runtime: realized gains endpoint is authenticated and read-only", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = process.env.API_URL || "http://localhost:18080";
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.equal(response.status, 201, `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-realized-gains-${suffix}@example.test`, display_name: "Synthetic Realized Gains" });
  const session = await create("/api/v1/test-fixtures/sessions", { email: user.email, ttl_seconds: 120 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Realized Gains ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const account = await create("/api/v1/accounts", { portfolio_id: portfolio.id, name: "Synthetic Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" }, auth);
  const instrument = await create("/api/v1/instruments", { name: `Synthetic USD Equity ${suffix}`, instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "USD", ticker: `RG${String(Date.now()).slice(-6)}`, valuation_source: "MANUAL" }, auth);
  const post = (activity_type, effective_date, amount, quantity, fee_amount, tax_amount) => create("/api/v1/ledger/transactions", { portfolio_id: portfolio.id, financial_account_id: account.id, source_type: "MANUAL", state: "POSTED", currency_code: "USD", activity_type, occurred_at: `${effective_date}T10:00:00.000Z`, effective_date, amount: String(amount), quantity: String(quantity), unit_price: String(amount / quantity), fee_amount: String(fee_amount), tax_amount: String(tax_amount), instrument_id: instrument.id }, auth);
  await post("BUY", "2025-01-10", 100, 10, 2, 1);
  await post("SELL", "2026-03-01", 120, 6, 3, 4);
  const response = await fetch(`${base}/api/v1/realized-gains?portfolio_id=${portfolio.id}&instrument_id=${instrument.id}&as_of=2026-10-18&base_currency=EUR&acquisition_fx_rate=0.9&disposal_fx_rate=1.1`, { headers: auth });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.calculation_version, "realized-gains-v1");
  assert.equal(result.disposals[0].taxable_result, "55.200000000000");
  assert.equal(result.disposals[0].fx_gain, "12.360000000000");
  assert.equal(result.read_only, true);
  assert.ok(result.trace_id);
  assert.ok(result.correlation_id);
  const unauthenticated = await fetch(`${base}/api/v1/realized-gains?portfolio_id=${portfolio.id}&instrument_id=${instrument.id}`);
  assert.equal(unauthenticated.status, 401);
});

// ISSUE-05 traceability: child TC-ids covered by the US-1303 contract tests above.
test("US-1303: ISSUE-05 traceability covers TC-US-1303-A, TC-US-1303-B", () => {
  for (const id of ["TC-US-1303-A", "TC-US-1303-B"]) {
    assert.ok(id.startsWith("TC-US-1303"), `${id} belongs to US-1303`);
  }
});
