import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const uiSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0908: monthly budgets expose groups, rollovers and actual-versus-budget", () => {
  for (const value of [
    "/api/v1/money-flow/budgets",
    "budget_plan",
    "budget_line",
    "rollover_enabled",
    "rollover_amount",
    "actual_amount",
    "variance_amount",
    "budget_group"
  ]) assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const value of ["Money Flow budgets", "Monthly budget", "Budget group", "Rollover", "Actual versus budget"]) {
    assert.match(uiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /CREATE TABLE budget_plan/);
  assert.match(schemaSource, /CREATE TABLE budget_line/);
});

test("TC-US-0908-runtime: budget actuals are category-scoped and rollover is retained", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-money-flow-0908-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Money Flow 0908" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };
  const jsonHeaders = { ...auth, "content-type": "application/json" };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: "Synthetic Money Flow 0908", reporting_currency_code: "EUR" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic budget account", account_type: "BANK", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();
  const categoryResponse = await fetch(`${api}/api/v1/money-flow/categories`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: "Synthetic budget groceries", category_type: "SPENDING" }) });
  assert.equal(categoryResponse.status, 201);
  const category = await categoryResponse.json();
  const scope = await fetch(`${api}/api/v1/money-flow/account-scope`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, is_enabled: true }) });
  assert.equal(scope.status, 200);
  const transactionResponse = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: "WITHDRAWAL", occurred_at: "2026-10-17T12:00:00.000Z", effective_date: "2026-10-17", amount: "42.50", currency_code: "EUR", source_type: "MANUAL", state: "POSTED", description: "Synthetic budget actual" }) });
  assert.equal(transactionResponse.status, 201);
  const transaction = await transactionResponse.json();
  const assignment = await fetch(`${api}/api/v1/money-flow/categories/bulk-reassign`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, category_id: category.id, transaction_ids: [transaction.id] }) });
  assert.equal(assignment.status, 200);
  const budget = await fetch(`${api}/api/v1/money-flow/budgets`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, period_start: "2026-10-01", period_end: "2026-10-31", rollover_enabled: true, groups: [{ name: "Synthetic essentials", lines: [{ category_id: category.id, planned_amount: "50.00", currency_code: "EUR", rollover_amount: "5.00" }] }] }) });
  assert.equal(budget.status, 201);
  const body = await budget.json();
  assert.equal(body.groups[0].name, "Synthetic essentials");
  assert.equal(body.groups[0].lines[0].actual_amount, "42.500000000000");
  assert.equal(body.groups[0].lines[0].variance_amount, "12.500000000000");
  assert.equal(body.calculation_version, "money-flow-budgets-v1");
  const listed = await fetch(`${api}/api/v1/money-flow/budgets?portfolio_id=${portfolio.id}&period_start=2026-10-01&period_end=2026-10-31`, { headers: auth });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).budgets.length, 1);
});
