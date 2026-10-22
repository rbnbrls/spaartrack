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

test("TC-US-0905: normalized payees, tags and bulk edit are exposed", () => {
  for (const value of [
    "/api/v1/money-flow/payees",
    "/api/v1/money-flow/tags",
    "/api/v1/money-flow/transactions/bulk-edit",
    "normalized_name",
    "transaction_tag",
    "ledger_transaction_tag",
    "payee_id",
    "tag_ids",
    "updated_count"
  ]) assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const value of ["Money Flow payees", "Normalized payee", "Tags", "Bulk edit"]) {
    assert.match(uiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /CREATE TABLE payee/);
  assert.match(schemaSource, /CREATE TABLE transaction_tag/);
  assert.match(schemaSource, /CREATE TABLE ledger_transaction_tag/);
});

test("TC-US-0905-runtime: payees and tags can be bulk-edited on scoped transactions", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-money-flow-0905-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Money Flow 0905" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ name: "Synthetic Money Flow 0905", reporting_currency_code: "EUR" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic payee account", account_type: "BANK", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();
  const jsonHeaders = { ...auth, "content-type": "application/json" };
  const create = async (path, body) => {
    const response = await fetch(`${api}${path}`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const payee = await create("/api/v1/money-flow/payees", { name: "  Synthetic Coffee  Shop " });
  assert.equal(payee.normalized_name, "synthetic coffee shop");
  const duplicate = await fetch(`${api}/api/v1/money-flow/payees`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: "synthetic   coffee shop" }) });
  assert.equal(duplicate.status, 409);
  const tag = await create("/api/v1/money-flow/tags", { name: "Needs review", color: "#f59e0b" });
  const secondTag = await create("/api/v1/money-flow/tags", { name: "Household" });
  const post = async (amount) => {
    const response = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: "WITHDRAWAL", occurred_at: "2026-10-17T12:00:00.000Z", effective_date: "2026-10-17", amount, currency_code: "EUR", source_type: "MANUAL", state: "POSTED", description: "Synthetic coffee shop purchase" }) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const first = await post("12.00");
  const second = await post("18.00");
  const edited = await fetch(`${api}/api/v1/money-flow/transactions/bulk-edit`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, transaction_ids: [first.id, second.id], payee_id: payee.id, tag_ids: [tag.id, secondTag.id] }) });
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).updated_count, 2);
  const assignments = await fetch(`${api}/api/v1/money-flow/payees-tags/assignments?portfolio_id=${portfolio.id}`, { headers: auth });
  assert.equal(assignments.status, 200);
  const result = await assignments.json();
  const selected = result.assignments.filter((item) => [first.id, second.id].includes(item.ledger_transaction_id));
  assert.equal(selected.length, 2);
  assert.ok(selected.every((item) => item.payee_id === payee.id));
  assert.deepEqual(selected.map((item) => item.tag_ids.sort()), [[tag.id, secondTag.id].sort(), [tag.id, secondTag.id].sort()]);
});
