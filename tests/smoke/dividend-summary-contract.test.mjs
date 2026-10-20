import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0703: TTM uses paid income and PADI uses explicit forecasts", () => {
  for (const value of ["/api/v1/dividend-summary", "dividendSummaryRoute", "/api/v1/dividend-forecasts", "dividendForecastRoute", "dividend_forecast", "TTM", "PADI", "dividend-income-v1"]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  for (const value of ["dividend-ttm", "dividend-padi", "dividend-forecast-form", "dividend_forecast", "TTM", "PADI"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-0703-runtime: TTM excludes old/projected events and PADI sums explicit forecast rules", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-dividend-summary-0703-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic dividend summary owner" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Dividend summary ${suffix}`, reporting_currency_code: "EUR", privacy_scope: "PRIVATE" }) });
  const portfolio = await portfolioResponse.json();
  const instrumentResponse = await fetch(`${api}/api/v1/instruments`, { method: "POST", headers: auth, body: JSON.stringify({ name: "Synthetic dividend summary equity", instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `SUM${suffix.replace(/[^0-9]/g, "").slice(-6)}`, valuation_source: "MANUAL" }) });
  const instrument = await instrumentResponse.json();
  const createIncome = (payment_date, status, gross_amount, tax_amount, net_amount) => fetch(`${api}/api/v1/income-events`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, instrument_id: instrument.id, event_type: "DIVIDEND", status, payment_date, gross_amount, tax_amount, fee_amount: "0.00", net_amount, currency_code: "EUR" }) });
  assert.equal((await createIncome("2026-10-17", "PAID", "20.00", "1.30", "18.70")).status, 201);
  assert.equal((await createIncome("2025-10-16", "PAID", "99.00", "0.00", "99.00")).status, 201);
  assert.equal((await createIncome("2026-12-17", "PROJECTED", "40.00", "4.00", "36.00")).status, 201);
  const forecast = await fetch(`${api}/api/v1/dividend-forecasts`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, instrument_id: instrument.id, forecast_period_start: "2026-11-01", forecast_period_end: "2027-10-31", forecast_amount_gross: "120.00", forecast_tax: "18.00", forecast_amount_net: "102.00", currency_code: "EUR", model: "SYNTHETIC_RULE", confidence: "0.90" }) });
  assert.equal(forecast.status, 201);
  const summary = await fetch(`${api}/api/v1/dividend-summary?portfolio_id=${portfolio.id}&as_of=2026-10-17`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(summary.status, 200);
  const payload = await summary.json();
  assert.equal(payload.calculation_version, "dividend-income-v1");
  assert.equal(payload.ttm.net_amount, "18.700000000000");
  assert.equal(payload.ttm.event_count, 1);
  assert.equal(payload.padi.net_amount, "102.000000000000");
  assert.equal(payload.padi.forecast_count, 1);
  assert.equal((await fetch(`${api}/api/v1/dividend-summary?portfolio_id=${portfolio.id}`, { headers: { authorization: `Bearer ${token}` } })).status, 200);
  assert.equal((await fetch(`${api}/api/v1/dividend-summary?portfolio_id=${portfolio.id}`)).status, 401);
  assert.equal((await fetch(`${api}/api/v1/dividend-forecasts?portfolio_id=${portfolio.id}`)).status, 401);
});
