import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0704: dividend growth exposes configurable annual buckets, YoY and CAGR", () => {
  for (const value of ["/api/v1/dividend-growth", "dividendGrowthRoute", "dividend-growth-v1", "yoy", "cagr", "calendar year", "PAID"]) {
    assert.match(apiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["dividend-growth-form", "dividend-growth-start", "dividend-growth-end", "dividend-growth-yoy", "dividend-growth-cagr", "dividend-growth-v1", "YoY", "CAGR"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-0704-runtime: paid income yields reproducible YoY and CAGR", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-dividend-growth-0704-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic dividend growth owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const portfolio = await (await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Dividend growth ${suffix}`, reporting_currency_code: "EUR", privacy_scope: "PRIVATE" }) })).json();
  const instrument = await (await fetch(`${api}/api/v1/instruments`, { method: "POST", headers: auth, body: JSON.stringify({ name: "Synthetic growth equity", instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `GRW${suffix.replace(/[^0-9]/g, "").slice(-6)}`, valuation_source: "MANUAL" }) })).json();
  const createIncome = (payment_date, net_amount) => fetch(`${api}/api/v1/income-events`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, instrument_id: instrument.id, event_type: "DIVIDEND", status: "PAID", payment_date, gross_amount: net_amount, tax_amount: "0.00", fee_amount: "0.00", net_amount, currency_code: "EUR" }) });
  assert.equal((await createIncome("2024-06-15", "100.00")).status, 201);
  assert.equal((await createIncome("2025-06-15", "120.00")).status, 201);
  assert.equal((await createIncome("2026-06-15", "144.00")).status, 201);
  const growth = await fetch(`${api}/api/v1/dividend-growth?portfolio_id=${portfolio.id}&start_date=2024-01-01&end_date=2026-12-31`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(growth.status, 200);
  const payload = await growth.json();
  assert.equal(payload.calculation_version, "dividend-growth-v1");
  assert.deepEqual(payload.annual_periods.map((period) => [period.period, period.net_amount]), [["2024", "100.000000000000"], ["2025", "120.000000000000"], ["2026", "144.000000000000"]]);
  assert.equal(payload.yoy.from_period, "2025");
  assert.equal(payload.yoy.to_period, "2026");
  assert.equal(payload.yoy.net_growth, "20.000000000000");
  assert.equal(payload.cagr.from_period, "2024");
  assert.equal(payload.cagr.to_period, "2026");
  assert.equal(payload.cagr.years, "2.000000000000");
  assert.equal(payload.cagr.net_growth, "20.000000000000");
  assert.equal((await fetch(`${api}/api/v1/dividend-growth?portfolio_id=${portfolio.id}&start_date=2024-01-01&end_date=2026-12-31`)).status, 401);
});
