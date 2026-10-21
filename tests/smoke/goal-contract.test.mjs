import { fixtureKey } from "../helpers/fixture-key.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-1104: net-worth goal contract is scoped, configurable and versioned", () => {
  for (const value of [
    "/api/v1/goals", "NET_WORTH", "target_amount", "target_date", "expected_annual_return",
    "monthly_contribution", "status", "goal-v1", "trace_id", "correlation_id", "read_only"
  ]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-1104-UI: goal controls and evidence are present", () => {
  for (const value of ["goal-panel", "goal-form", "goal-status", "Net-worth goal", "/api/v1/goals", "goal-v1"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-1104-runtime: owner can create and read a synthetic net-worth goal", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-goal-1104-${suffix}@example.test`;
  const created = await (await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Goal Owner" }) })).json();
  const session = await (await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "x-synthetic-fixture-key": fixtureKey(), "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 }) })).json();
  const auth = { authorization: `Bearer ${session.token}`, "content-type": "application/json" };
  const portfolio = await (await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Synthetic Goal ${suffix}`, reporting_currency_code: "EUR" }) })).json();
  const goalResponse = await fetch(`${api}/api/v1/goals`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ portfolio_id: portfolio.id, name: "Emergency net worth", goal_type: "NET_WORTH", target_amount: "25000.00", target_currency_code: "EUR", target_date: "2030-12-31", expected_annual_return: "0.05", monthly_contribution: "500.00" })
  });
  assert.equal(goalResponse.status, 201);
  const goal = await goalResponse.json();
  assert.equal(goal.goal_type, "NET_WORTH");
  assert.equal(goal.target_amount, "25000.00");
  assert.equal(goal.target_date, "2030-12-31");
  assert.equal(goal.expected_annual_return, "0.05");
  assert.equal(goal.monthly_contribution, "500.00");
  assert.equal(goal.status, "ACTIVE");
  assert.equal(goal.calculation_version, "goal-v1");
  assert.deepEqual(goal.privacy_scope, { user_id: created.id, portfolio_id: portfolio.id });
  assert.match(goal.trace_id, /^[0-9a-f-]{16,}$/i);
  const read = await fetch(`${api}/api/v1/goals/${goal.id}`, { headers: { authorization: `Bearer ${session.token}` } });
  assert.equal(read.status, 200);
  const readBack = await read.json();
  assert.equal(readBack.id, goal.id);
  assert.equal(readBack.read_only, true);
});

