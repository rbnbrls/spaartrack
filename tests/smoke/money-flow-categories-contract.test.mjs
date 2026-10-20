import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const uiSource = readWebSource();
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0904: Money Flow categories expose hierarchy, inactive status and bulk reassignment", () => {
  for (const value of [
    "/api/v1/money-flow/categories",
    "/bulk-reassign",
    "parent_id",
    "is_active",
    "transaction_category",
    "category_id",
    "updated_count"
  ]) assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const value of ["Money Flow categories", "Parent category", "Subcategory", "bulk-reassign", "Inactive"]) {
    assert.match(uiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /CREATE TABLE category/);
  assert.match(schemaSource, /CREATE TABLE transaction_category/);
});

test("TC-US-0904-runtime: parent-child categories can be deactivated and transactions bulk-reassigned", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-money-flow-0904-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Money Flow 0904" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ name: "Synthetic Money Flow 0904", reporting_currency_code: "EUR" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic category account", account_type: "BANK", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();
  const jsonHeaders = { ...auth, "content-type": "application/json" };
  const createCategory = async (body) => {
    const response = await fetch(`${api}/api/v1/money-flow/categories`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const parent = await createCategory({ name: "Synthetic household", category_type: "SPENDING" });
  const child = await createCategory({ name: "Synthetic groceries", category_type: "SPENDING", parent_id: parent.id });
  const target = await createCategory({ name: "Synthetic dining", category_type: "SPENDING" });
  assert.equal(child.parent_id, parent.id);

  const inactive = await fetch(`${api}/api/v1/money-flow/categories/${parent.id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ is_active: false }) });
  assert.equal(inactive.status, 200);
  assert.equal((await inactive.json()).is_active, false);

  const post = async (amount) => {
    const response = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: "WITHDRAWAL", occurred_at: "2026-10-17T12:00:00.000Z", effective_date: "2026-10-17", amount, currency_code: "EUR", source_type: "MANUAL", state: "POSTED", description: "Synthetic category transaction" }) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const first = await post("12.00");
  const second = await post("18.00");
  const reassigned = await fetch(`${api}/api/v1/money-flow/categories/bulk-reassign`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, transaction_ids: [first.id, second.id], category_id: target.id }) });
  assert.equal(reassigned.status, 200);
  assert.equal((await reassigned.json()).updated_count, 2);
  const assignments = await fetch(`${api}/api/v1/money-flow/categories/assignments?portfolio_id=${portfolio.id}`, { headers: auth });
  assert.equal(assignments.status, 200);
  const result = await assignments.json();
  assert.deepEqual(result.assignments.filter((item) => [first.id, second.id].includes(item.ledger_transaction_id)).map((item) => item.category_id), [target.id, target.id]);
  const categories = await fetch(`${api}/api/v1/money-flow/categories?portfolio_id=${portfolio.id}`, { headers: auth });
  assert.equal(categories.status, 200);
  const categoryResult = await categories.json();
  assert.ok(categoryResult.categories.some((item) => item.id === child.id && item.parent_id === parent.id));
  assert.equal(categoryResult.categories.find((item) => item.id === parent.id).is_active, false);
});
