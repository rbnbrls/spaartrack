import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const uiSource = readWebSource();
const api = apiUrl;

test("TC-US-0906: categorisation rules expose match types, priority and account scope", () => {
  for (const value of [
    "/api/v1/money-flow/rules",
    "/apply",
    "CONTAINS",
    "STARTS_WITH",
    "EXACT",
    "REGEX",
    "priority",
    "account_id",
    "review_required",
    "transaction_rule"
  ]) assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const value of ["Money Flow rules", "Match type", "Account scope", "Apply categorisation rules", "Priority"]) {
    assert.match(uiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /CREATE TABLE transaction_rule/);
});

test("TC-US-0906-runtime: deterministic rule matching honors priority, matcher type and account scope", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-money-flow-0906-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Money Flow 0906" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };
  const jsonHeaders = { ...auth, "content-type": "application/json" };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: "Synthetic Money Flow 0906", reporting_currency_code: "EUR" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const createAccount = async (name) => {
    const response = await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, name, account_type: "BANK", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const accountOne = await createAccount("Synthetic rules account one");
  const accountTwo = await createAccount("Synthetic rules account two");
  const createCategory = async (name) => {
    const response = await fetch(`${api}/api/v1/money-flow/categories`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name, category_type: "SPENDING" }) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const createPayee = async (name) => {
    const response = await fetch(`${api}/api/v1/money-flow/payees`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name }) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const category = await createCategory("Synthetic rules spending");
  const payee = await createPayee("Synthetic rules payee");
  const createRule = async (body) => {
    const response = await fetch(`${api}/api/v1/money-flow/rules`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const scopedExact = await createRule({ name: "Scoped exact", priority: 10, account_id: accountOne.id, conditions: { match_type: "EXACT", field: "description", value: "Synthetic Coffee Shop" }, actions: { category_id: category.id, payee_id: payee.id } });
  const broadContains = await createRule({ name: "Broad contains", priority: 20, conditions: { match_type: "CONTAINS", field: "description", value: "coffee" }, actions: { payee_id: payee.id } });
  await createRule({ name: "Starts with fallback", priority: 30, conditions: { match_type: "STARTS_WITH", field: "description", value: "Synthetic" }, actions: { payee_id: payee.id } });
  await createRule({ name: "Regex fallback", priority: 40, conditions: { match_type: "REGEX", field: "description", value: "Coffee (Shop|House)" }, actions: { payee_id: payee.id } });
  const post = async (accountId, description) => {
    const response = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: accountId, activity_type: "WITHDRAWAL", occurred_at: "2026-10-17T12:00:00.000Z", effective_date: "2026-10-17", amount: "12.00", currency_code: "EUR", source_type: "MANUAL", state: "POSTED", description }) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const first = await post(accountOne.id, "Synthetic Coffee Shop");
  const second = await post(accountTwo.id, "Synthetic Coffee Shop");
  const applied = await fetch(`${api}/api/v1/money-flow/rules/apply`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, transaction_ids: [first.id, second.id] }) });
  assert.equal(applied.status, 200);
  const appliedBody = await applied.json();
  assert.equal(appliedBody.applied_count, 2);
  assert.equal(appliedBody.matches.find((item) => item.transaction_id === first.id).rule_id, scopedExact.id);
  assert.equal(appliedBody.matches.find((item) => item.transaction_id === second.id).rule_id, broadContains.id);
  const assignments = await fetch(`${api}/api/v1/money-flow/payees-tags/assignments?portfolio_id=${portfolio.id}`, { headers: auth });
  assert.equal(assignments.status, 200);
  const result = await assignments.json();
  const selected = result.assignments.filter((item) => [first.id, second.id].includes(item.ledger_transaction_id));
  assert.equal(selected.length, 2);
  assert.ok(selected.every((item) => item.payee_id === payee.id && item.classification_source === "RULE"));
});
