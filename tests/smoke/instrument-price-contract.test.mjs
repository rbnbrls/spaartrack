import { fixtureKey } from "../helpers/fixture-key.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0402: instrument price observation contract is explicit", () => {
  for (const value of [
    "/api/v1/instrument-prices", "instrument_price", "instrument_id", "price_at",
    "currency_code", "source", "captured_at", "is_close", "PRICE_ALREADY_EXISTS"
  ]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /CREATE TABLE instrument_price/);
  assert.match(schemaSource, /PRIMARY KEY \(instrument_id, price_at, source\)/);
});

test("TC-US-0402-runtime: current/history prices persist with captured-at and conflict-safe duplicates", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-price-0402-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic Prices" })
  });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: { "x-synthetic-fixture-key": fixtureKey(), "content-type": "application/json" },
    body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };

  const instrument = await fetch(`${api}/api/v1/instruments`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      name: `Synthetic Price Instrument ${suffix}`, instrument_type: "STOCK",
      asset_class: "EQUITY", currency_code: "EUR", ticker: `SYN${String(Date.now()).slice(-6)}`,
      valuation_source: "MANUAL", is_listed: true
    })
  });
  assert.equal(instrument.status, 201);
  const instrumentBody = await instrument.json();
  const instrumentId = instrumentBody.id;
  const historicalAt = new Date(Date.now() - 86_400_000).toISOString();
  const currentAt = new Date().toISOString();
  const historicalPayload = {
    instrument_id: instrumentId, price_at: historicalAt, price: "101.250000000000",
    currency_code: "EUR", source: "SYNTHETIC", is_close: true
  };
  const currentPayload = {
    instrument_id: instrumentId, price_at: currentAt, price: "102.750000000000",
    currency_code: "EUR", source: "SYNTHETIC", is_close: false
  };

  const historical = await fetch(`${api}/api/v1/instrument-prices`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify(historicalPayload)
  });
  assert.equal(historical.status, 201);
  const historicalBody = await historical.json();
  assert.equal(historicalBody.instrument_id, instrumentId);
  assert.equal(historicalBody.price, historicalPayload.price);
  assert.equal(historicalBody.currency_code, "EUR");
  assert.equal(historicalBody.source, "SYNTHETIC");
  assert.equal(historicalBody.is_close, true);
  assert.ok(historicalBody.captured_at);

  const current = await fetch(`${api}/api/v1/instrument-prices`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify(currentPayload)
  });
  assert.equal(current.status, 201);
  assert.equal((await current.json()).is_close, false);

  const history = await fetch(`${api}/api/v1/instrument-prices?instrument_id=${instrumentId}`, { headers: auth });
  assert.equal(history.status, 200);
  const prices = (await history.json()).prices;
  assert.equal(prices.length, 2);
  assert.equal(prices[0].price_at, currentAt);
  assert.equal(prices[1].price_at, historicalAt);
  assert.ok(prices.every((price) => price.captured_at));

  const duplicate = await fetch(`${api}/api/v1/instrument-prices`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify(historicalPayload)
  });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error, "PRICE_ALREADY_EXISTS");

  const invalidCurrency = await fetch(`${api}/api/v1/instrument-prices`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ ...currentPayload, price_at: new Date(Date.now() + 1_000).toISOString(), currency_code: "ZZZ" })
  });
  assert.equal(invalidCurrency.status, 400);
  assert.equal((await invalidCurrency.json()).error, "UNKNOWN_CURRENCY");

  const unauthenticated = await fetch(`${api}/api/v1/instrument-prices?instrument_id=${instrumentId}`);
  assert.equal(unauthenticated.status, 401);
});
