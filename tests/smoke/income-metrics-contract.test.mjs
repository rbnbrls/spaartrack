import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0702: income metrics expose gross, tax, net, yield and yield-on-cost", () => {
  for (const value of ["/api/v1/income-metrics", "incomeMetricsRoute", "gross_amount", "tax_amount", "net_amount", "yield", "yield_on_cost", "income-metrics-v1", "formula_version"]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  for (const value of ["dividend-gross-total", "dividend-tax-total", "dividend-net-total", "dividend-yield", "dividend-yield-on-cost", "income-metrics-v1"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-0702-runtime: dividend metrics are traceable to income events, price and position cost", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-income-metrics-0702-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic income metrics owner" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Income metrics ${suffix}`, reporting_currency_code: "EUR", privacy_scope: "PRIVATE" }) });
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic metrics account", account_type: "BROKERAGE", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) });
  const account = await accountResponse.json();
  const instrumentResponse = await fetch(`${api}/api/v1/instruments`, { method: "POST", headers: auth, body: JSON.stringify({ name: "Synthetic metrics equity", instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `MET${suffix.replace(/[^0-9]/g, "").slice(-6)}`, valuation_source: "MANUAL" }) });
  const instrument = await instrumentResponse.json();
  const buy = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: "BUY", occurred_at: "2026-10-17T10:00:00.000Z", effective_date: "2026-10-17", amount: "100.00", currency_code: "EUR", source_type: "MANUAL", state: "POSTED", instrument_id: instrument.id, quantity: "10", unit_price: "10.00", description: "Synthetic metrics BUY" }) });
  assert.equal(buy.status, 201);
  const price = await fetch(`${api}/api/v1/instrument-prices`, { method: "POST", headers: auth, body: JSON.stringify({ instrument_id: instrument.id, price_at: "2026-10-17T12:00:00.000Z", price: "12.50", currency_code: "EUR", source: "SYNTHETIC", is_close: true }) });
  assert.equal(price.status, 201);
  const income = await fetch(`${api}/api/v1/income-events`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, instrument_id: instrument.id, event_type: "DIVIDEND", status: "PAID", payment_date: "2026-10-17", gross_amount: "25.00", tax_amount: "3.75", fee_amount: "0.00", net_amount: "21.25", currency_code: "EUR" }) });
  assert.equal(income.status, 201);
  const metrics = await fetch(`${api}/api/v1/income-metrics?portfolio_id=${portfolio.id}`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(metrics.status, 200);
  const payload = await metrics.json();
  assert.equal(payload.calculation_version, "income-metrics-v1");
  assert.equal(payload.metrics.length, 1);
  const metric = payload.metrics[0];
  assert.equal(metric.gross_amount, "25.000000000000");
  assert.equal(metric.tax_amount, "3.750000000000");
  assert.equal(metric.net_amount, "21.250000000000");
  assert.equal(metric.market_value, "125.000000000000");
  assert.equal(metric.cost_basis, "100.000000000000");
  assert.equal(metric.yield, "17.000000000000");
  assert.equal(metric.yield_on_cost, "21.250000000000");
  assert.equal(metric.formula_version, "income-metrics-v1");
  assert.equal((await fetch(`${api}/api/v1/income-metrics?portfolio_id=${portfolio.id}`)).status, 401);
});
