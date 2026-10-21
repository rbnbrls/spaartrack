import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const migrationSource = readFileSync(new URL("database/migrations/0014-money-flow-account-scope.sql", root), "utf8");
const api = apiUrl;

test("TC-US-0901: Money Flow account scope is opt-in and portfolio/user scoped", () => {
  for (const value of [
    "/api/v1/money-flow/account-scope",
    "money_flow_account_scope",
    "portfolio_id",
    "user_id",
    "financial_account_id",
    "is_enabled",
    "BANK",
    "CASH",
    "CREDIT_CARD"
  ]) assert.match(apiSource + schemaSource + migrationSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS/);
  assert.match(migrationSource, /PRIMARY KEY \(portfolio_id, user_id, financial_account_id\)/);
});

test("TC-US-0901-runtime: member opts in/out only eligible accounts and cannot cross portfolio/user scope", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const createUser = async (label) => {
    const email = `synthetic-money-flow-0901-${label}-${suffix}@example.test`;
    const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: `Synthetic Money Flow ${label}` }) });
    assert.equal(created.status, 201);
    const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
    assert.equal(login.status, 201);
    const session = await login.json();
    return { authorization: `Bearer ${session.token}` };
  };
  const owner = await createUser("owner");
  const other = await createUser("other");
  const makePortfolio = async (auth, name) => {
    const response = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ name, reporting_currency_code: "EUR" }) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const portfolio = await makePortfolio(owner, "Synthetic Money Flow Portfolio");
  const otherPortfolio = await makePortfolio(other, "Synthetic Other Portfolio");
  const createAccount = async (auth, portfolioId, name, accountType) => {
    const response = await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ portfolio_id: portfolioId, name, account_type: accountType, tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const bank = await createAccount(owner, portfolio.id, "Synthetic bank", "BANK");
  const cash = await createAccount(owner, portfolio.id, "Synthetic cash", "CASH");
  const creditCard = await createAccount(owner, portfolio.id, "Synthetic card", "CREDIT_CARD");
  const brokerage = await createAccount(owner, portfolio.id, "Synthetic brokerage", "BROKERAGE");
  const otherCash = await createAccount(other, otherPortfolio.id, "Other cash", "CASH");

  const initial = await fetch(`${api}/api/v1/money-flow/account-scope?portfolio_id=${portfolio.id}`, { headers: owner });
  assert.equal(initial.status, 200);
  assert.deepEqual((await initial.json()).accounts.map((account) => [account.id, account.is_enabled]).sort((a, b) => a[0].localeCompare(b[0])), [[bank.id, false], [cash.id, false], [creditCard.id, false]].sort((a, b) => a[0].localeCompare(b[0])));

  for (const account of [bank, cash, creditCard]) {
    const response = await fetch(`${api}/api/v1/money-flow/account-scope`, { method: "PUT", headers: { ...owner, "content-type": "application/json" }, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, is_enabled: true }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).is_enabled, true);
  }
  const disabledBrokerage = await fetch(`${api}/api/v1/money-flow/account-scope`, { method: "PUT", headers: { ...owner, "content-type": "application/json" }, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: brokerage.id, is_enabled: true }) });
  assert.equal(disabledBrokerage.status, 400);
  assert.equal((await disabledBrokerage.json()).error, "MONEY_FLOW_ACCOUNT_TYPE_NOT_ELIGIBLE");
  const forbiddenOtherPortfolio = await fetch(`${api}/api/v1/money-flow/account-scope`, { method: "PUT", headers: { ...owner, "content-type": "application/json" }, body: JSON.stringify({ portfolio_id: otherPortfolio.id, financial_account_id: otherCash.id, is_enabled: true }) });
  assert.equal(forbiddenOtherPortfolio.status, 403);
  const readBack = await fetch(`${api}/api/v1/money-flow/account-scope?portfolio_id=${portfolio.id}`, { headers: owner });
  assert.deepEqual((await readBack.json()).accounts.map((account) => account.is_enabled), [true, true, true]);
  const optOut = await fetch(`${api}/api/v1/money-flow/account-scope`, { method: "PUT", headers: { ...owner, "content-type": "application/json" }, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: cash.id, is_enabled: false }) });
  assert.equal(optOut.status, 200);
  assert.equal((await optOut.json()).is_enabled, false);
});
