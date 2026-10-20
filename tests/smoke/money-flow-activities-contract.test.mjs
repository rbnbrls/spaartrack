import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const uiSource = readWebSource();
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0902: Money Flow activities expose category type and final amount from the canonical ledger", () => {
  for (const value of [
    "/api/v1/money-flow/activities",
    "category_type",
    "final_amount",
    "signed_final_amount",
    "INCOME",
    "SPENDING",
    "SAVING",
    "TRANSFER",
    "fee_amount",
    "tax_amount",
    "ledger_transaction",
    "money_flow_account_scope",
    "POSTED"
  ]) assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const value of ["money-flow-activities", "final_amount", "category_type", "/api/v1/money-flow/activities"]) {
    assert.match(uiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /CREATE TABLE transaction_category/);
});

test("TC-US-0902-runtime: scoped activities classify income/spending/saving/transfer and account for fees/taxes", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const createUser = async () => {
    const email = `synthetic-money-flow-0902-${suffix}@example.test`;
    const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Money Flow 0902" }) });
    assert.equal(created.status, 201);
    const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
    assert.equal(login.status, 201);
    const session = await login.json();
    return { authorization: `Bearer ${session.token}` };
  };
  const auth = await createUser();
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ name: "Synthetic Money Flow 0902", reporting_currency_code: "EUR" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const createAccount = async (name) => {
    const response = await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ portfolio_id: portfolio.id, name, account_type: "BANK", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const account = await createAccount("Synthetic flow account");
  const destination = await createAccount("Synthetic destination account");
  const scope = await fetch(`${api}/api/v1/money-flow/account-scope`, { method: "PUT", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, is_enabled: true }) });
  assert.equal(scope.status, 200);
  const post = async (activityType, amount, feeAmount = "0", taxAmount = "0", destinationFinancialAccountId = undefined) => {
    const response = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, destination_financial_account_id: destinationFinancialAccountId, activity_type: activityType, occurred_at: "2026-10-17T10:00:00.000Z", effective_date: "2026-10-17", amount, currency_code: "EUR", fee_amount: feeAmount, tax_amount: taxAmount, source_type: "MANUAL", state: "POSTED", description: `Synthetic ${activityType}` }) });
    assert.equal(response.status, 201);
  };
  await post("DEPOSIT", "100.00");
  await post("CREDIT", "25.00", "1.00", "3.00");
  await post("WITHDRAWAL", "40.00", "2.00", "0.00");
  await post("TRANSFER_OUT", "10.00", "0", "0", destination.id);

  const response = await fetch(`${api}/api/v1/money-flow/activities?portfolio_id=${portfolio.id}&period_start=2026-10-01&period_end=2026-10-31`, { headers: auth });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.calculation_version, "money-flow-activities-v1");
  assert.equal(result.activities.length, 4);
  const byType = Object.fromEntries(result.activities.map((activity) => [activity.activity_type, activity]));
  assert.equal(byType.DEPOSIT.category_type, "SAVING");
  assert.equal(byType.DEPOSIT.final_amount, "100.000000000000");
  assert.equal(byType.CREDIT.category_type, "INCOME");
  assert.equal(byType.CREDIT.final_amount, "21.000000000000");
  assert.equal(byType.CREDIT.signed_final_amount, "21.000000000000");
  assert.equal(byType.WITHDRAWAL.category_type, "SPENDING");
  assert.equal(byType.WITHDRAWAL.final_amount, "42.000000000000");
  assert.equal(byType.WITHDRAWAL.signed_final_amount, "-42.000000000000");
  assert.equal(byType.TRANSFER_OUT.category_type, "TRANSFER");
  assert.equal(byType.TRANSFER_OUT.signed_final_amount, "-10.000000000000");
  assert.deepEqual(result.totals, {
    INCOME: "21.000000000000",
    SAVING: "100.000000000000",
    SPENDING: "-42.000000000000",
    TRANSFER: "0.000000000000"
  });
  const unauthenticated = await fetch(`${api}/api/v1/money-flow/activities?portfolio_id=${portfolio.id}`);
  assert.equal(unauthenticated.status, 401);
});
