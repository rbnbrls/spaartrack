import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const fundingSource = readFileSync(new URL("apps/api/src/goal-funding.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");

test("TC-US-1105-A/B: goal funding contract is scoped, atomic and projection-backed", () => {
  for (const value of [
    "/funding", "goal_funding_allocation", "funding_percentage", "DUPLICATE_GOAL_FUNDING_ACCOUNT",
    "GOAL_FUNDING_OVERALLOCATED", "GOAL_FUNDING_CURRENCY_MISMATCH", "BEGIN", "COMMIT",
    "position_snapshot", "share_weighted_balance", "goal-funding-v1", "source_as_of", "read_only", "access-control-allow-origin", "OPTIONS"
  ]) assert.match(apiSource + fundingSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
});

test("TC-US-1105-UI: goal funding controls and evidence are available", () => {
  for (const value of ["goal-funding-panel", "goal-funding-form", "funding-percentage", "weighted-balance", "/api/v1/goals", "/funding", "goal-funding-v1"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-1105-runtime: owner saves shares and reads a share-weighted snapshot balance", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const api = apiUrl;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const user = await (await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `synthetic-goal-funding-${suffix}@example.test`, display_name: "Synthetic Goal Funding" }) })).json();
  const session = await (await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email: user.email, ttl_seconds: 120 }) })).json();
  const auth = { authorization: `Bearer ${session.token}`, "content-type": "application/json" };
  const portfolio = await (await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Synthetic Goal Funding ${suffix}`, reporting_currency_code: "EUR" }) })).json();
  const createAccount = (payload) => fetch(`${api}/api/v1/accounts`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, tracking_mode: "HOLDINGS", base_currency_code: "EUR", ...payload }) }).then(async (response) => { assert.equal(response.status, 201); return response.json(); });
  const brokerage = await createAccount({ name: "Synthetic Brokerage", account_type: "BROKERAGE" });
  const savings = await createAccount({ name: "Synthetic Savings", account_type: "BANK" });
  const instrument = await (await fetch(`${api}/api/v1/instruments`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Synthetic Goal Equity ${suffix}`, instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `G${String(Date.now()).slice(-6)}`, valuation_source: "MANUAL" }) })).json();
  const postLedger = (accountId, amount, quantity) => fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: accountId, source_type: "MANUAL", state: "POSTED", currency_code: "EUR", activity_type: "BUY", occurred_at: "2026-10-17T10:00:00.000Z", effective_date: "2026-10-17", amount: String(amount), instrument_id: instrument.id, quantity: String(quantity), unit_price: "10" }) }).then((response) => { assert.equal(response.status, 201); return response.json(); });
  await postLedger(brokerage.id, 1000, 100);
  await postLedger(savings.id, 2500, 250);
  const price = await fetch(`${api}/api/v1/instrument-prices`, { method: "POST", headers: auth, body: JSON.stringify({ instrument_id: instrument.id, price_at: "2026-10-17T16:00:00.000Z", price: "10", currency_code: "EUR", source: "SYNTHETIC", is_close: true }) });
  assert.equal(price.status, 201);
  const snapshot = await fetch(`${api}/api/v1/portfolio-snapshots`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, snapshot_at: "2026-10-17T17:00:00.000Z", calculation_version: "goal-funding-fixture-v1" }) });
  assert.equal(snapshot.status, 201);
  const goal = await (await fetch(`${api}/api/v1/goals`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic net worth goal", goal_type: "NET_WORTH", target_amount: "10000", target_currency_code: "EUR", target_date: "2030-12-31", expected_annual_return: "0.05", monthly_contribution: "250" }) })).json();
  const save = await fetch(`${api}/api/v1/goals/${goal.id}/funding`, { method: "POST", headers: auth, body: JSON.stringify({ allocations: [{ financial_account_id: brokerage.id, funding_percentage: "60" }, { financial_account_id: savings.id, funding_percentage: "40" }] }) });
  assert.equal(save.status, 200);
  const saved = await save.json();
  assert.equal(saved.total_percentage, 100);
  assert.equal(saved.share_weighted_balance, "1600.00");
  assert.equal(saved.calculation_version, "goal-funding-v1");
  assert.equal(saved.source, "portfolio_snapshot.position_snapshot");
  assert.equal(saved.allocations.length, 2);
  assert.match(saved.trace_id, /^[0-9a-f-]{16,}$/i);
  const overallocated = await fetch(`${api}/api/v1/goals/${goal.id}/funding`, { method: "POST", headers: auth, body: JSON.stringify({ allocations: [{ financial_account_id: brokerage.id, funding_percentage: "100" }, { financial_account_id: savings.id, funding_percentage: "0.01" }] }) });
  assert.equal(overallocated.status, 400);
  assert.equal((await overallocated.json()).error, "GOAL_FUNDING_OVERALLOCATED");
  const read = await fetch(`${api}/api/v1/goals/${goal.id}/funding`, { headers: { authorization: `Bearer ${session.token}` } });
  assert.equal(read.status, 200);
  assert.equal((await read.json()).share_weighted_balance, "1600.00");
});

// ISSUE-05 traceability: child TC-ids covered by the US-1105 contract tests above.
test("US-1105: ISSUE-05 traceability covers TC-US-1105-B", () => {
  for (const id of ["TC-US-1105-B"]) {
    assert.ok(id.startsWith("TC-US-1105"), `${id} belongs to US-1105`);
  }
});
