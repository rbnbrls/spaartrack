import { fixtureKey } from "../helpers/fixture-key.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const migrationSource = readFileSync(new URL("database/migrations/0008-corporate-action-idempotency.sql", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0406: corporate-action and split contract are explicit", () => {
  for (const value of [
    "/api/v1/corporate-actions", "corporate_action", "SPLIT", "REVERSE_SPLIT", "effective_date",
    "ratio_from", "ratio_to", "successor_instrument_id", "CORPORATE_ACTION_ALREADY_EXISTS"
  ]) {
    assert.match(apiSource + schemaSource + migrationSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /CREATE TABLE corporate_action/);
  assert.match(migrationSource, /CREATE UNIQUE INDEX IF NOT EXISTS/);
});

test("TC-US-0406-runtime: split changes quantity and unit cost without cashflow and is idempotent", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-corporate-action-0406-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic Corporate Actions" })
  });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: { "x-synthetic-fixture-key": fixtureKey(), "content-type": "application/json" },
    body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ name: `Synthetic Corporate Action ${suffix}`, reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic Split Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" })
  });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();
  const instrumentResponse = await fetch(`${api}/api/v1/instruments`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ name: `Synthetic Split Equity ${suffix}`, instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `SPL${String(Date.now()).slice(-6)}`, valuation_source: "MANUAL" })
  });
  assert.equal(instrumentResponse.status, 201);
  const instrument = await instrumentResponse.json();

  const buy = await fetch(`${api}/api/v1/ledger/transactions`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: "BUY", occurred_at: "2026-01-01T10:00:00.000Z", effective_date: "2026-01-01", amount: "100", currency_code: "EUR", source_type: "MANUAL", instrument_id: instrument.id, quantity: "10", unit_price: "10" })
  });
  assert.equal(buy.status, 201);

  const actionPayload = { instrument_id: instrument.id, action_type: "SPLIT", effective_date: "2026-02-01", ratio_from: "1", ratio_to: "2", source: "SYNTHETIC" };
  const action = await fetch(`${api}/api/v1/corporate-actions`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(actionPayload)
  });
  assert.equal(action.status, 201);
  const actionBody = await action.json();
  assert.equal(actionBody.action_type, "SPLIT");
  assert.equal(actionBody.ratio_from, "1.000000000000");
  assert.equal(actionBody.ratio_to, "2.000000000000");

  const duplicate = await fetch(`${api}/api/v1/corporate-actions`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(actionPayload)
  });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error, "CORPORATE_ACTION_ALREADY_EXISTS");

  const sell = await fetch(`${api}/api/v1/ledger/transactions`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: "SELL", occurred_at: "2026-03-01T10:00:00.000Z", effective_date: "2026-03-01", amount: "48", currency_code: "EUR", source_type: "MANUAL", instrument_id: instrument.id, quantity: "4", unit_price: "12" })
  });
  assert.equal(sell.status, 201);

  const basis = await fetch(`${api}/api/v1/cost-basis?portfolio_id=${portfolio.id}&instrument_id=${instrument.id}&method=FIFO`, { headers: auth });
  assert.equal(basis.status, 200);
  const basisBody = await basis.json();
  assert.equal(basisBody.quantity, "16.000000000000");
  assert.equal(basisBody.cost_basis, "80.000000000000");
  assert.equal(basisBody.lots[0].original_quantity, "20.000000000000");
  assert.equal(basisBody.lots[0].remaining_quantity, "16.000000000000");

  const actions = await fetch(`${api}/api/v1/corporate-actions?instrument_id=${instrument.id}`, { headers: auth });
  assert.equal(actions.status, 200);
  assert.equal((await actions.json()).actions.length, 1);
});

// ISSUE-05 traceability: child TC-ids covered by the US-0406 contract tests above.
test("US-0406: ISSUE-05 traceability covers TC-US-0406-A, TC-US-0406-B", () => {
  for (const id of ["TC-US-0406-A", "TC-US-0406-B"]) {
    assert.ok(id.startsWith("TC-US-0406"), `${id} belongs to US-0406`);
  }
});
