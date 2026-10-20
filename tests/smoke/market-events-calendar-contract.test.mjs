import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0705: market events are filterable by type and date range", () => {
  for (const value of ["/api/v1/market-events", "marketEventsRoute", "EX_DIVIDEND", "DIVIDEND_PAYMENT", "AGM", "EARNINGS", "ECONOMIC", "market_event"]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["market-events-calendar", "market-events-form", "market-events-type", "EX_DIVIDEND", "DIVIDEND_PAYMENT", "AGM", "EARNINGS", "ECONOMIC"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-0705-runtime: synthetic events can be listed by type and date range", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-market-events-0705-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic market events owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const portfolio = await (await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Market events ${suffix}`, reporting_currency_code: "EUR", privacy_scope: "PRIVATE" }) })).json();
  const account = await (await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic events account", account_type: "BROKERAGE", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) })).json();
  const instrument = await (await fetch(`${api}/api/v1/instruments`, { method: "POST", headers: auth, body: JSON.stringify({ name: "Synthetic events equity", instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `EVT${suffix.replace(/[^0-9]/g, "").slice(-6)}`, valuation_source: "MANUAL" }) })).json();
  const buy = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: "BUY", occurred_at: "2026-01-10T10:00:00.000Z", effective_date: "2026-01-10", amount: "100.00", currency_code: "EUR", source_type: "MANUAL", state: "POSTED", instrument_id: instrument.id, quantity: "1", unit_price: "100.00", description: "Synthetic event holding" }) });
  assert.equal(buy.status, 201);
  const createEvent = (event_type, title, starts_at) => fetch(`${api}/api/v1/market-events`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, instrument_id: instrument.id, event_type, title, starts_at, source: "SYNTHETIC", source_external_id: `${event_type}-${suffix}` }) });
  for (const [type, title, date] of [["EX_DIVIDEND", "Synthetic ex-dividend", "2026-04-01T09:00:00.000Z"], ["DIVIDEND_PAYMENT", "Synthetic payment", "2026-04-05T09:00:00.000Z"], ["AGM", "Synthetic AGM", "2026-05-01T09:00:00.000Z"], ["EARNINGS", "Synthetic earnings", "2026-06-01T09:00:00.000Z"], ["ECONOMIC", "Synthetic CPI", "2026-07-01T09:00:00.000Z"]]) assert.equal((await createEvent(type, title, date)).status, 201);
  const all = await fetch(`${api}/api/v1/market-events?portfolio_id=${portfolio.id}&start_date=2026-01-01&end_date=2026-12-31`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(all.status, 200);
  const allPayload = await all.json();
  assert.equal(allPayload.events.length, 5);
  assert.deepEqual(allPayload.counts, { total: 5, EX_DIVIDEND: 1, DIVIDEND_PAYMENT: 1, AGM: 1, EARNINGS: 1, TRADING_UPDATE: 0, CAPITAL_MARKETS_DAY: 0, ECONOMIC: 1, OTHER: 0 });
  const agm = await fetch(`${api}/api/v1/market-events?portfolio_id=${portfolio.id}&event_type=AGM&start_date=2026-01-01&end_date=2026-12-31`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal((await agm.json()).events.length, 1);
  assert.equal((await fetch(`${api}/api/v1/market-events?portfolio_id=${portfolio.id}&event_type=INVALID&start_date=2026-01-01&end_date=2026-12-31`, { headers: { authorization: `Bearer ${token}` } })).status, 400);
  assert.equal((await fetch(`${api}/api/v1/market-events?portfolio_id=${portfolio.id}&start_date=2026-01-01&end_date=2026-12-31`)).status, 401);
});
