import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const uiSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0903: paired transfers and credit-card payments expose neutral Money Flow semantics", () => {
  for (const value of [
    "LIABILITY_PAYMENT",
    "is_contribution_neutral",
    "neutral_reason",
    "paired_transaction_id",
    "TRANSFER"
  ]) assert.match(apiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const value of ["is_contribution_neutral", "neutral_reason", "Creditcard payment", "TRANSFER"]) {
    assert.match(uiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-0903-runtime: paired transfers and liability payments stay visible without changing contribution or spending totals", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const created = await fetch(`${api}/api/v1/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `synthetic-money-flow-0903-${suffix}@example.test`, display_name: "Synthetic Money Flow 0903" })
  });
  assert.equal(created.status, 201);
  const user = await created.json();
  const login = await fetch(`${api}/api/v1/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: user.email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ name: "Synthetic Money Flow 0903", reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const createAccount = async (name, accountType) => {
    const response = await fetch(`${api}/api/v1/accounts`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ portfolio_id: portfolio.id, name, account_type: accountType, tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" })
    });
    assert.equal(response.status, 201);
    return response.json();
  };
  const bank = await createAccount("Synthetic bank 0903", "BANK");
  const card = await createAccount("Synthetic creditcard 0903", "CREDIT_CARD");
  for (const account of [bank, card]) {
    const scope = await fetch(`${api}/api/v1/money-flow/account-scope`, {
      method: "PUT",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, is_enabled: true })
    });
    assert.equal(scope.status, 200);
  }
  const post = async (body) => {
    const response = await fetch(`${api}/api/v1/ledger/transactions`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ portfolio_id: portfolio.id, occurred_at: "2026-10-17T10:00:00.000Z", effective_date: "2026-10-17", currency_code: "EUR", source_type: "MANUAL", state: "POSTED", ...body })
    });
    assert.equal(response.status, 201);
    return response.json();
  };
  await post({ financial_account_id: bank.id, activity_type: "DEPOSIT", amount: "100.00", description: "Synthetic external saving" });
  const transfer = await post({ financial_account_id: bank.id, destination_financial_account_id: card.id, activity_type: "TRANSFER_OUT", amount: "20.00", description: "Synthetic paired card transfer" });
  await post({ financial_account_id: bank.id, activity_type: "LIABILITY_PAYMENT", amount: "15.00", description: "Synthetic creditcard payment" });

  const response = await fetch(`${api}/api/v1/money-flow/activities?portfolio_id=${portfolio.id}&period_start=2026-10-01&period_end=2026-10-31`, { headers: auth });
  assert.equal(response.status, 200);
  const result = await response.json();
  const visible = Object.fromEntries(result.activities.map((activity) => [activity.id, activity]));
  const transferActivity = visible[transfer.id];
  const paymentActivity = result.activities.find((activity) => activity.activity_type === "LIABILITY_PAYMENT");
  assert.ok(transferActivity);
  assert.ok(paymentActivity);
  assert.equal(transferActivity.category_type, "TRANSFER");
  assert.equal(transferActivity.is_contribution_neutral, true);
  assert.equal(paymentActivity.category_type, "TRANSFER");
  assert.equal(paymentActivity.is_contribution_neutral, true);
  assert.equal(result.totals.SAVING, "100.000000000000");
  assert.equal(result.totals.SPENDING, "0.000000000000");
  assert.equal(result.totals.TRANSFER, "0.000000000000");
});
