import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const uiSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0909: Money Flow analysis exposes flow totals, category drill-down and parent-child consistency", () => {
  for (const value of [
    "/api/v1/money-flow/analysis",
    "drilldown",
    "parent_id",
    "category_type",
    "period_start",
    "period_end",
    "account_scope",
    "transactions"
  ]) assert.match(apiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const value of ["Money Flow analysis", "Income", "Saving", "Spending", "Drill-down", "Parent/child totals"]) {
    assert.match(uiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-0909-runtime: flow totals and drill-down transactions remain consistent for parent-child categories", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-money-flow-0909-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Money Flow 0909" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };
  const jsonHeaders = { ...auth, "content-type": "application/json" };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: "Synthetic Money Flow 0909", reporting_currency_code: "EUR" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic analysis account", account_type: "BANK", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();
  const scope = await fetch(`${api}/api/v1/money-flow/account-scope`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, is_enabled: true }) });
  assert.equal(scope.status, 200);
  const createCategory = async (body) => {
    const response = await fetch(`${api}/api/v1/money-flow/categories`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const income = await createCategory({ name: "Synthetic analysis income", category_type: "INCOME" });
  const spendingParent = await createCategory({ name: "Synthetic analysis spending", category_type: "SPENDING" });
  const spendingChild = await createCategory({ name: "Synthetic analysis groceries", category_type: "SPENDING", parent_id: spendingParent.id });
  const saving = await createCategory({ name: "Synthetic analysis saving", category_type: "SAVING" });
  const post = async (activityType, amount, description) => {
    const response = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: activityType, occurred_at: "2026-10-17T12:00:00.000Z", effective_date: "2026-10-17", amount, currency_code: "EUR", source_type: "MANUAL", state: "POSTED", description }) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const incomeTx = await post("CREDIT", "100.00", "Synthetic analysis salary");
  const savingTx = await post("DEPOSIT", "25.00", "Synthetic analysis saving");
  const spendingTx = await post("WITHDRAWAL", "12.50", "Synthetic analysis groceries");
  for (const [categoryId, transactionId] of [[income.id, incomeTx.id], [saving.id, savingTx.id], [spendingChild.id, spendingTx.id]]) {
    const assignment = await fetch(`${api}/api/v1/money-flow/categories/bulk-reassign`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, category_id: categoryId, transaction_ids: [transactionId] }) });
    assert.equal(assignment.status, 200);
  }
  const analysis = await fetch(`${api}/api/v1/money-flow/analysis?portfolio_id=${portfolio.id}&period_start=2026-10-01&period_end=2026-10-31`, { headers: auth });
  assert.equal(analysis.status, 200);
  const body = await analysis.json();
  assert.equal(body.calculation_version, "money-flow-analysis-v1");
  assert.equal(body.totals.INCOME, "100.000000000000");
  assert.equal(body.totals.SAVING, "25.000000000000");
  assert.equal(body.totals.SPENDING, "-12.500000000000");
  const spending = body.flows.find((flow) => flow.category_type === "SPENDING");
  assert.equal(spending.total, "-12.500000000000");
  assert.equal(spending.categories[0].name, "Synthetic analysis spending");
  assert.equal(spending.categories[0].children[0].total, "-12.500000000000");
  assert.equal(spending.categories[0].children[0].transactions[0].id, spendingTx.id);
  const drilldown = await fetch(`${api}/api/v1/money-flow/analysis/drilldown?portfolio_id=${portfolio.id}&category_id=${spendingChild.id}&period_start=2026-10-01&period_end=2026-10-31`, { headers: auth });
  assert.equal(drilldown.status, 200);
  assert.equal((await drilldown.json()).transactions.length, 1);
});
