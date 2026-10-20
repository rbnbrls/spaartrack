import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const adrSource = readFileSync(new URL("docs/adr/0002-canonical-ledger.md", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0303: instrument contract supports identifiers, exchange, asset class, currency and custom assets", () => {
  for (const value of [
    "/api/v1/instruments", "CREATE TABLE instrument", "ticker", "isin", "cusip", "exchange_id",
    "asset_class", "currency_code", "CUSTOM", "valuation_source", "instrument_identifier"
  ]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /instrument_isin_uq/);
  assert.match(adrSource, /ledger_transaction en ledger_entry zijn de financiële bron van waarheid/);
});

test("TC-US-0303-runtime: authenticated user registers standard and custom instruments", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = Date.now().toString();
  const email = `synthetic-instrument-0303-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic Instrument Owner 0303" })
  });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };

  const stock = await fetch(`${api}/api/v1/instruments`, {
    method: "POST", headers: { ...auth, "content-type": "application/json", "x-trace-id": "trace-instrument-0303" },
    body: JSON.stringify({
      name: "Synthetic Acme Equity", instrument_type: "STOCK", asset_class: "EQUITY",
      currency_code: "USD", ticker: `SYN${suffix.slice(-6)}`, isin: `SYN${suffix}`, cusip: suffix.slice(-9),
      exchange: "XNAS", valuation_source: "MANUAL"
    })
  });
  assert.equal(stock.status, 201);
  const stockBody = await stock.json();
  assert.equal(stockBody.instrument_type, "STOCK");
  assert.equal(stockBody.asset_class, "EQUITY");
  assert.equal(stockBody.currency_code, "USD");
  assert.equal(stockBody.ticker, `SYN${suffix.slice(-6)}`);
  assert.equal(stockBody.isin, `SYN${suffix}`);
  assert.equal(stockBody.exchange, "XNAS");
  assert.equal(stockBody.trace_id, "trace-instrument-0303");

  const custom = await fetch(`${api}/api/v1/instruments`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ name: "Synthetic Private Asset", instrument_type: "CUSTOM", asset_class: "OTHER", currency_code: "EUR", valuation_source: "MANUAL" })
  });
  assert.equal(custom.status, 201);
  const customBody = await custom.json();
  assert.equal(customBody.instrument_type, "CUSTOM");
  assert.equal(customBody.asset_class, "OTHER");
  assert.equal(customBody.currency_code, "EUR");

  const read = await fetch(`${api}/api/v1/instruments/${stockBody.id}`, { headers: auth });
  assert.equal(read.status, 200);
  assert.equal((await read.json()).cusip, suffix.slice(-9));

  const unauthenticated = await fetch(`${api}/api/v1/instruments`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(unauthenticated.status, 401);
});
