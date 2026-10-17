import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0302: financial account types, tracking modes and statuses are contractual", () => {
  for (const value of ["/api/v1/accounts", "financial_account", "BROKERAGE", "BANK", "CASH", "CREDIT_CARD", "LOAN", "CUSTOM", "TRANSACTIONS", "HOLDINGS", "BALANCE_ONLY", "ARCHIVED"]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /UNIQUE \(portfolio_id, name\)/);
});

test("TC-US-0302-runtime: owner registers all local account types with tracking/status and outsider is denied", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const createUser = async (label) => {
    const email = `synthetic-account-0302-${label}-${suffix}@example.test`;
    const created = await fetch(`${api}/api/v1/users`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: `Synthetic Account ${label}` })
    });
    assert.equal(created.status, 201);
    const user = await created.json();
    const login = await fetch(`${api}/api/v1/sessions`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 })
    });
    assert.equal(login.status, 201);
    const session = await login.json();
    return { ...user, auth: { authorization: `Bearer ${session.token}` } };
  };
  const owner = await createUser("owner");
  const outsider = await createUser("outsider");
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST", headers: { ...owner.auth, "content-type": "application/json" }, body: JSON.stringify({ name: "Synthetic Accounts Portfolio", reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();

  const cases = [
    ["BROKERAGE", "HOLDINGS", "ACTIVE"],
    ["BANK", "TRANSACTIONS", "ACTIVE"],
    ["CASH", "BALANCE_ONLY", "ACTIVE"],
    ["CREDIT_CARD", "TRANSACTIONS", "HIDDEN"],
    ["LOAN", "BALANCE_ONLY", "ARCHIVED"],
    ["CUSTOM", "TRANSACTIONS", "ACTIVE"]
  ];
  for (const [accountType, trackingMode, status] of cases) {
    const created = await fetch(`${api}/api/v1/accounts`, {
      method: "POST", headers: { ...owner.auth, "content-type": "application/json" },
      body: JSON.stringify({ portfolio_id: portfolio.id, name: `${accountType} account`, account_type: accountType, tracking_mode: trackingMode, status, base_currency_code: "EUR" })
    });
    assert.equal(created.status, 201);
    const account = await created.json();
    assert.equal(account.portfolio_id, portfolio.id);
    assert.equal(account.account_type, accountType);
    assert.equal(account.tracking_mode, trackingMode);
    assert.equal(account.status, status);

    const read = await fetch(`${api}/api/v1/accounts/${account.id}`, { headers: owner.auth });
    assert.equal(read.status, 200);
    assert.equal((await read.json()).account_type, accountType);
  }

  const denied = await fetch(`${api}/api/v1/accounts`, {
    method: "POST", headers: { ...outsider.auth, "content-type": "application/json" },
    body: JSON.stringify({ portfolio_id: portfolio.id, name: "Outsider account", account_type: "CASH" })
  });
  assert.equal(denied.status, 403);
});
