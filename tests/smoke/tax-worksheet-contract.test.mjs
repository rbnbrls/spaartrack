import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/tax-worksheet.ts", root), "utf8");
const web = readWebSource();

test("TC-US-1307: tax worksheets are jurisdictional, scoped and not general advice", () => {
  for (const marker of ["/api/v1/tax-worksheets", "taxWorksheetRoute", "portfolio_member", "trace_id", "correlation_id", "CALCULATE"]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const marker of ["buildTaxWorksheet", "ruleset", "ruleset_version", "disclaimer", "owner_scope", "tax-worksheet-v1", "read_only"]) assert.match(kernel, new RegExp(marker));
  for (const marker of ["tax-worksheet-panel", "tax-worksheet-form", "tax-worksheet-result", "tax-worksheet-ruleset", "tax-worksheet-disclaimer", "tax-worksheet-owner-scope"]) assert.match(web, new RegExp(marker));
});

test("TC-US-1307-runtime: tax worksheet endpoint is authenticated", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const response = await fetch(`${apiUrl}/api/v1/tax-worksheets?portfolio_id=00000000-0000-0000-0000-000000000000&jurisdiction=NL&tax_year=2026`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});

test("TC-US-1307-runtime: synthetic worksheet exposes ruleset and owner scope", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = apiUrl;
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-tax-worksheet-${suffix}@example.test`, display_name: "Synthetic Tax Worksheet" });
  const session = await create("/api/v1/test-fixtures/sessions", { email: user.email, ttl_seconds: 120 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Tax Worksheet ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const account = await create("/api/v1/accounts", { portfolio_id: portfolio.id, name: "Synthetic Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" }, auth);
  const instrument = await create("/api/v1/instruments", { name: `Synthetic Tax Worksheet Equity ${suffix}`, instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `TW${String(Date.now()).slice(-6)}`, valuation_source: "MANUAL" }, auth);
  await create("/api/v1/ledger/transactions", { portfolio_id: portfolio.id, financial_account_id: account.id, source_type: "MANUAL", state: "POSTED", currency_code: "EUR", activity_type: "BUY", occurred_at: "2026-01-10T10:00:00.000Z", effective_date: "2026-01-10", amount: "100", fee_amount: "0", tax_amount: "0", instrument_id: instrument.id, quantity: "10", unit_price: "10" }, auth);
  await create("/api/v1/ledger/transactions", { portfolio_id: portfolio.id, financial_account_id: account.id, source_type: "MANUAL", state: "POSTED", currency_code: "EUR", activity_type: "SELL", occurred_at: "2026-06-01T10:00:00.000Z", effective_date: "2026-06-01", amount: "120", fee_amount: "0", tax_amount: "0", instrument_id: instrument.id, quantity: "6", unit_price: "20" }, auth);
  await create("/api/v1/income-events", { portfolio_id: portfolio.id, instrument_id: instrument.id, event_type: "DIVIDEND", status: "PAID", payment_date: "2026-04-10", gross_amount: "100", tax_amount: "15", fee_amount: "0", net_amount: "85", currency_code: "EUR" }, auth);
  const response = await fetch(`${base}/api/v1/tax-worksheets?portfolio_id=${portfolio.id}&jurisdiction=NL&tax_year=2026`, { headers: auth });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ruleset, "NL-box-3-synthetic-v1");
  assert.equal(result.ruleset_version, "2026.10");
  assert.equal(result.owner_scope, `portfolio:${portfolio.id}`);
  assert.match(result.disclaimer, /geen algemeen fiscaal advies/i);
  assert.equal(result.summary.total_income, "100.000000000000");
  assert.equal(result.summary.total_tax, "15.000000000000");
  assert.equal(result.read_only, true);
  assert.ok(result.trace_id);
  assert.ok(result.correlation_id);
});
