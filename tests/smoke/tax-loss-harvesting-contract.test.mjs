import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/tax-loss-harvesting.ts", root), "utf8");
const web = readWebSource();

test("TC-US-1305: tax-loss harvesting is read-only, traceable and human-acceptance ready", () => {
  for (const marker of ["/api/v1/tax-loss-harvesting", "taxLossHarvestingRoute", "portfolio_member", "trace_id", "correlation_id", "CALCULATE"]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const marker of ["buildTaxLossHarvestingCandidates", "estimated_tax_saving", "unrealized_loss", "holding_period", "rationale", "tax-loss-harvesting-v1", "canonical-ledger"]) assert.match(kernel, new RegExp(marker));
  for (const marker of ["tax-loss-harvesting-panel", "tax-loss-harvesting-form", "tax-loss-harvesting-result", "tax-loss-harvesting-rationale"]) assert.match(web, new RegExp(marker));
});

test("TC-US-1305-runtime: tax-loss harvesting endpoint is authenticated", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const response = await fetch(`${process.env.API_URL || "http://localhost:18080"}/api/v1/tax-loss-harvesting?portfolio_id=00000000-0000-0000-0000-000000000000&as_of=2026-10-18`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});

test("TC-US-1305-runtime: synthetic loss candidate is calculated without ledger mutation", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = process.env.API_URL || "http://localhost:18080";
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-tax-loss-${suffix}@example.test`, display_name: "Synthetic Tax Loss" });
  const session = await create("/api/v1/test-fixtures/sessions", { email: user.email, ttl_seconds: 120 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Tax Loss ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const account = await create("/api/v1/accounts", { portfolio_id: portfolio.id, name: "Synthetic Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" }, auth);
  const instrument = await create("/api/v1/instruments", { name: `Synthetic Loss Equity ${suffix}`, instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `TL${String(Date.now()).slice(-6)}`, valuation_source: "MANUAL" }, auth);
  const transaction = await create("/api/v1/ledger/transactions", { portfolio_id: portfolio.id, financial_account_id: account.id, source_type: "MANUAL", state: "POSTED", currency_code: "EUR", activity_type: "BUY", occurred_at: "2025-01-10T10:00:00.000Z", effective_date: "2025-01-10", amount: "100", fee_amount: "0", tax_amount: "0", instrument_id: instrument.id, quantity: "10", unit_price: "10" }, auth);
  await create("/api/v1/instrument-prices", { instrument_id: instrument.id, price_at: "2026-10-18T16:00:00.000Z", price: "8", currency_code: "EUR", source: `synthetic-tax-loss-${suffix}`, is_close: true }, auth);
  const resultResponse = await fetch(`${base}/api/v1/tax-loss-harvesting?portfolio_id=${portfolio.id}&as_of=2026-10-18&estimated_tax_rate=0.25`, { headers: auth });
  assert.equal(resultResponse.status, 200);
  const result = await resultResponse.json();
  assert.equal(result.calculation_version, "tax-loss-harvesting-v1");
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].unrealized_loss, "-20.000000000000");
  assert.equal(result.candidates[0].estimated_tax_saving, "5.000000000000");
  assert.equal(result.candidates[0].holding_period, "LONG");
  assert.ok(result.candidates[0].rationale);
  assert.equal(result.read_only, true);
  assert.ok(result.trace_id);
  assert.ok(result.correlation_id);
  const transactionResponse = await fetch(`${base}/api/v1/ledger/transactions/${transaction.id}`, { headers: auth });
  assert.equal((await transactionResponse.json()).state, "POSTED");
});
