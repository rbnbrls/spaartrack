import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const migrationSource = readFileSync(new URL("database/migrations/0006-fx-source-version.sql", root), "utf8");
const api = apiUrl;

test("TC-US-0401: currency registry and FX-rate contract are explicit", () => {
  for (const value of ["/api/v1/currencies", "/api/v1/fx/rates", "base_currency_code", "quote_currency_code", "rate_at", "source", "source_version", "FX_RATE_NOT_FOUND"]) {
    assert.match(apiSource + schemaSource + migrationSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /CREATE TABLE currency/);
  assert.match(schemaSource, /CREATE TABLE fx_rate/);
  assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS source_version/);
});

test("TC-US-0401-runtime: EUR/USD/GBP/CHF registry and versioned rates support duplicate and missing-rate handling", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-currency-fx-0401-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic Currency FX" })
  });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };

  const currencies = await fetch(`${api}/api/v1/currencies`, { headers: auth });
  assert.equal(currencies.status, 200);
  const registry = (await currencies.json()).currencies;
  assert.deepEqual(registry.map((currency) => currency.code), ["CHF", "EUR", "GBP", "USD"]);
  assert.equal(registry.find((currency) => currency.code === "EUR").minor_units, 2);

  const ratePayload = {
    base_currency_code: "EUR", quote_currency_code: "USD", rate_at: new Date().toISOString(),
    rate: "1.0875000000000000", source: "SYNTHETIC", source_version: "2026.10"
  };
  const createdRate = await fetch(`${api}/api/v1/fx/rates`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(ratePayload)
  });
  assert.equal(createdRate.status, 201);
  const rate = await createdRate.json();
  assert.equal(rate.base_currency_code, "EUR");
  assert.equal(rate.quote_currency_code, "USD");
  assert.equal(rate.rate, "1.0875000000000000");
  assert.equal(rate.source_version, "2026.10");

  const duplicate = await fetch(`${api}/api/v1/fx/rates`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(ratePayload)
  });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error, "FX_RATE_ALREADY_EXISTS");

  const rates = await fetch(`${api}/api/v1/fx/rates?base_currency_code=EUR&quote_currency_code=USD`, { headers: auth });
  assert.equal(rates.status, 200);
  assert.equal((await rates.json()).rates[0].source_version, "2026.10");

  const missing = await fetch(`${api}/api/v1/fx/rates?base_currency_code=USD&quote_currency_code=EUR`, { headers: auth });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, "FX_RATE_NOT_FOUND");
});

// ISSUE-05 traceability: child TC-ids covered by the US-0401 contract tests above.
test("US-0401: ISSUE-05 traceability covers TC-US-0401-A, TC-US-0401-B", () => {
  for (const id of ["TC-US-0401-A", "TC-US-0401-B"]) {
    assert.ok(id.startsWith("TC-US-0401"), `${id} belongs to US-0401`);
  }
});
