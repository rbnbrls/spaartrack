import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/wash-sale.ts", root), "utf8");
const web = readWebSource();

test("TC-US-1306: wash-sale risks are read-only, traceable and acceptance-ready", () => {
  for (const marker of ["/api/v1/wash-sale-risks", "washSaleRoute", "portfolio_member", "trace_id", "correlation_id", "CALCULATE"]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const marker of ["detectWashSaleRisks", "relevant_window", "related_instrument_id", "confidence", "AT_RISK", "wash-sale-v1", "canonical-ledger"]) assert.match(kernel, new RegExp(marker));
  for (const marker of ["wash-sale-panel", "wash-sale-form", "wash-sale-result", "wash-sale-window", "wash-sale-status"]) assert.match(web, new RegExp(marker));
});

test("TC-US-1306-runtime: wash-sale endpoint is authenticated", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const response = await fetch(`${process.env.API_URL || "http://localhost:18080"}/api/v1/wash-sale-risks?portfolio_id=00000000-0000-0000-0000-000000000000&as_of=2026-10-18`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});

test("TC-US-1306-runtime: synthetic loss sale reports related purchase and preserves ledger", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = process.env.API_URL || "http://localhost:18080";
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-wash-sale-${suffix}@example.test`, display_name: "Synthetic Wash Sale" });
  const session = await create("/api/v1/sessions", { email: user.email, ttl_seconds: 120 });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Wash Sale ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const account = await create("/api/v1/accounts", { portfolio_id: portfolio.id, name: "Synthetic Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" }, auth);
  const instrument = await create("/api/v1/instruments", { name: `Synthetic Wash Equity ${suffix}`, instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `WS${String(Date.now()).slice(-6)}`, valuation_source: "MANUAL" }, auth);
  const post = (activity_type, effective_date, amount, quantity) => create("/api/v1/ledger/transactions", { portfolio_id: portfolio.id, financial_account_id: account.id, source_type: "MANUAL", state: "POSTED", currency_code: "EUR", activity_type, occurred_at: `${effective_date}T10:00:00.000Z`, effective_date, amount: String(amount), fee_amount: "0", tax_amount: "0", instrument_id: instrument.id, quantity: String(quantity), unit_price: String(amount / quantity) }, auth);
  const buy = await post("BUY", "2026-01-10", 100, 10);
  const sell = await post("SELL", "2026-10-01", 80, 10);
  await post("BUY", "2026-10-15", 80, 10);
  const resultResponse = await fetch(`${base}/api/v1/wash-sale-risks?portfolio_id=${portfolio.id}&as_of=2026-10-18&window_days=30`, { headers: auth });
  assert.equal(resultResponse.status, 200);
  const result = await resultResponse.json();
  assert.equal(result.calculation_version, "wash-sale-v1");
  assert.equal(result.risks.length, 1);
  assert.equal(result.risks[0].loss_sale_id, sell.id);
  assert.equal(result.risks[0].related_purchase_id !== null, true);
  assert.equal(result.risks[0].status, "AT_RISK");
  assert.equal(result.risks[0].confidence, "HIGH");
  assert.deepEqual(result.risks[0].relevant_window, { start: "2026-09-01", end: "2026-10-31" });
  assert.ok(result.trace_id);
  assert.ok(result.correlation_id);
  const buyResponse = await fetch(`${base}/api/v1/ledger/transactions/${buy.id}`, { headers: auth });
  assert.equal((await buyResponse.json()).state, "POSTED");
});
