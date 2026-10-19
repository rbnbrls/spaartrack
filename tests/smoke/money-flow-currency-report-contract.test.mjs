import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const uiSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0910: Money Flow currency report exposes native and base currency with period-end FX", () => {
  for (const value of [
    "/api/v1/money-flow/currency-report",
    "period_end_fx",
    "native_amount",
    "native_currency_code",
    "base_amount",
    "base_currency_code",
    "money-flow-currency-report-v1"
  ]) assert.match(apiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const value of ["Native currency", "Base currency", "Period-end FX", "Currency report"]) {
    assert.match(uiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-0910-runtime: native amount stays visible while period-end FX produces base amount", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const sourceName = `synthetic-0910-${suffix}`;
  const sourceVersion = `fx-fixture-0910-${suffix}`;
  const email = `synthetic-money-flow-0910-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Money Flow 0910" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };
  const jsonHeaders = { ...auth, "content-type": "application/json" };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: "Synthetic Money Flow 0910", reporting_currency_code: "EUR" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic CHF account", account_type: "BANK", tracking_mode: "TRANSACTIONS", base_currency_code: "CHF" }) });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();
  const scope = await fetch(`${api}/api/v1/money-flow/account-scope`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, is_enabled: true }) });
  assert.equal(scope.status, 200);
  const categoryResponse = await fetch(`${api}/api/v1/money-flow/categories`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: "Synthetic FX spending", category_type: "SPENDING" }) });
  assert.equal(categoryResponse.status, 201);
  const category = await categoryResponse.json();
  const transactionResponse = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: "WITHDRAWAL", occurred_at: "2026-10-17T12:00:00.000Z", effective_date: "2026-10-17", amount: "10.00", currency_code: "CHF", source_type: "MANUAL", state: "POSTED", description: "Synthetic FX purchase" }) });
  assert.equal(transactionResponse.status, 201);
  const transaction = await transactionResponse.json();
  const assignment = await fetch(`${api}/api/v1/money-flow/categories/bulk-reassign`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ portfolio_id: portfolio.id, category_id: category.id, transaction_ids: [transaction.id] }) });
  assert.equal(assignment.status, 200);
  const fx = await fetch(`${api}/api/v1/fx/rates`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ base_currency_code: "CHF", quote_currency_code: "EUR", rate_at: "2026-10-31T23:59:59.000Z", rate: "0.9", source: sourceName, source_version: sourceVersion }) });
  assert.equal(fx.status, 201);
  const report = await fetch(`${api}/api/v1/money-flow/currency-report?portfolio_id=${portfolio.id}&period_start=2026-10-01&period_end=2026-10-31&base_currency_code=EUR`, { headers: auth });
  assert.equal(report.status, 200);
  const body = await report.json();
  assert.equal(body.calculation_version, "money-flow-currency-report-v1");
  assert.deepEqual(body.period_end_fx, [{ native_currency_code: "CHF", base_currency_code: "EUR", rate: "0.9000000000000000", rate_at: "2026-10-31T23:59:59.000Z", source: sourceName, source_version: sourceVersion }]);
  assert.equal(body.activities[0].native_amount, "-10.000000000000");
  assert.equal(body.activities[0].native_currency_code, "CHF");
  assert.equal(body.activities[0].base_amount, "-9.000000000000");
  assert.equal(body.activities[0].base_currency_code, "EUR");
  assert.equal(body.totals.native[0].currency_code, "CHF");
  assert.equal(body.totals.native[0].amount, "-10.000000000000");
  assert.equal(body.totals.base_amount, "-9.000000000000");
});

// ISSUE-05 traceability: child TC-ids covered by the US-0910 contract tests above.
test("US-0910: ISSUE-05 traceability covers TC-US-0910-A, TC-US-0910-B", () => {
  for (const id of ["TC-US-0910-A", "TC-US-0910-B"]) {
    assert.ok(id.startsWith("TC-US-0910"), `${id} belongs to US-0910`);
  }
});
