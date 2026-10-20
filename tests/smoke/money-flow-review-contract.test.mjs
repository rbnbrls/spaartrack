import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const uiSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0907: review queue exposes confidence, source, override and audit boundaries", () => {
  for (const value of [
    "/api/v1/money-flow/review-queue",
    "review_required",
    "confidence",
    "classification_source",
    "OVERRIDE",
    "reviewed_by",
    "reviewed_at",
    "MONEY_FLOW_REVIEW"
  ]) assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const value of ["Money Flow review queue", "Confidence", "Override", "Review audit", "Accept review"]) {
    assert.match(uiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /confidence numeric\(5, 4\)/);
  assert.match(schemaSource, /reviewed_by uuid/);
  assert.match(schemaSource, /reviewed_at timestamptz/);
});

test("TC-US-0907-runtime: review-required rule enters queue and override closes it with audit evidence", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-money-flow-0907-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Money Flow 0907" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };
  const jsonHeaders = { ...auth, "content-type": "application/json" };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: "Synthetic Money Flow 0907", reporting_currency_code: "EUR" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic review account", account_type: "BANK", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();
  const categoryResponse = await fetch(`${api}/api/v1/money-flow/categories`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: "Synthetic reviewed spending", category_type: "SPENDING" }) });
  assert.equal(categoryResponse.status, 201);
  const category = await categoryResponse.json();
  const payeeResponse = await fetch(`${api}/api/v1/money-flow/payees`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: "Synthetic override payee" }) });
  assert.equal(payeeResponse.status, 201);
  const payee = await payeeResponse.json();
  const ruleResponse = await fetch(`${api}/api/v1/money-flow/rules`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: "Synthetic review rule", priority: 10, review_required: true, conditions: { match_type: "CONTAINS", field: "description", value: "Review me" }, actions: { category_id: category.id, confidence: 0.62 } }) });
  assert.equal(ruleResponse.status, 201);
  const rule = await ruleResponse.json();
  const transactionResponse = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: "WITHDRAWAL", occurred_at: "2026-10-17T12:00:00.000Z", effective_date: "2026-10-17", amount: "12.00", currency_code: "EUR", source_type: "MANUAL", state: "POSTED", description: "Review me synthetic transaction" }) });
  assert.equal(transactionResponse.status, 201);
  const transaction = await transactionResponse.json();
  const apply = await fetch(`${api}/api/v1/money-flow/rules/apply`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, transaction_ids: [transaction.id] }) });
  assert.equal(apply.status, 200);
  assert.equal((await apply.json()).matches[0].rule_id, rule.id);
  const queue = await fetch(`${api}/api/v1/money-flow/review-queue?portfolio_id=${portfolio.id}`, { headers: auth });
  assert.equal(queue.status, 200);
  const queueBody = await queue.json();
  assert.equal(queueBody.items.length, 1);
  assert.equal(queueBody.items[0].confidence, "0.6200");
  assert.equal(queueBody.items[0].classification_source, "RULE");
  const override = await fetch(`${api}/api/v1/money-flow/review-queue/${transaction.id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ action: "OVERRIDE", payee_id: payee.id, category_id: category.id, tag_ids: [] }) });
  assert.equal(override.status, 200);
  const overrideBody = await override.json();
  assert.equal(overrideBody.status, "REVIEWED");
  assert.equal(overrideBody.classification_source, "MANUAL");
  const emptyQueue = await fetch(`${api}/api/v1/money-flow/review-queue?portfolio_id=${portfolio.id}`, { headers: auth });
  assert.equal((await emptyQueue.json()).items.length, 0);
});
