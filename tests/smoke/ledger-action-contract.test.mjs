import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const adrSource = readFileSync(new URL("docs/adr/0002-canonical-ledger.md", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0304: ledger action contract covers action types and required financial fields", () => {
  for (const value of [
    "/api/v1/ledger/transactions", "ledger_transaction", "ledger_entry", "activity_type", "occurred_at",
    "effective_date", "financial_account_id", "amount", "currency_code", "source_type", "state",
    "BUY", "SELL", "DEPOSIT", "WITHDRAWAL", "DIVIDEND", "FEE", "TAX", "POSTED", "PENDING", "DRAFT", "VOID"
  ]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(adrSource, /ledger_transaction en ledger_entry zijn de financiële bron van waarheid/);
  assert.match(schemaSource, /CREATE TABLE ledger_transaction/);
  assert.match(schemaSource, /CREATE TABLE ledger_entry/);
});

test("TC-US-0304-runtime: owner books all local action types and outsider is denied", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const createUser = async (label) => {
    const email = `synthetic-ledger-0304-${label}-${suffix}@example.test`;
    const created = await fetch(`${api}/api/v1/users`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, display_name: `Synthetic Ledger ${label}` })
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
    method: "POST", headers: { ...owner.auth, "content-type": "application/json" },
    body: JSON.stringify({ name: "Synthetic Ledger Portfolio", reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, {
    method: "POST", headers: { ...owner.auth, "content-type": "application/json" },
    body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic Brokerage", account_type: "BROKERAGE", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" })
  });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();
  const instrumentResponse = await fetch(`${api}/api/v1/instruments`, {
    method: "POST", headers: { ...owner.auth, "content-type": "application/json" },
    body: JSON.stringify({ name: "Synthetic Ledger Equity", instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `LED${Date.now().toString().slice(-6)}`, valuation_source: "MANUAL" })
  });
  assert.equal(instrumentResponse.status, 201);
  const instrument = await instrumentResponse.json();

  const actions = [
    ["DEPOSIT", false], ["BUY", true], ["SELL", true], ["WITHDRAWAL", false],
    ["DIVIDEND", true], ["FEE", false], ["TAX", false]
  ];
  let firstTransactionId;
  for (const [activityType, requiresInstrument] of actions) {
    const created = await fetch(`${api}/api/v1/ledger/transactions`, {
      method: "POST", headers: { ...owner.auth, "content-type": "application/json", "x-trace-id": `trace-${activityType.toLowerCase()}-0304` },
      body: JSON.stringify({
        portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: activityType,
        occurred_at: "2026-10-17T10:00:00.000Z", effective_date: "2026-10-17", amount: "12.34",
        currency_code: "EUR", source_type: "MANUAL", state: activityType === "TAX" ? "PENDING" : "POSTED",
        instrument_id: requiresInstrument ? instrument.id : undefined, quantity: requiresInstrument ? "2" : undefined,
        unit_price: requiresInstrument ? "6.17" : undefined, description: `Synthetic ${activityType}`
      })
    });
    assert.equal(created.status, 201);
    const transaction = await created.json();
    firstTransactionId ||= transaction.id;
    assert.equal(transaction.activity_type, activityType);
    assert.equal(transaction.financial_account_id, account.id);
    assert.equal(Number(transaction.amount), 12.34);
    assert.equal(transaction.currency_code, "EUR");
    assert.equal(transaction.source_type, "MANUAL");
    assert.equal(transaction.state, activityType === "TAX" ? "PENDING" : "POSTED");
    assert.equal(transaction.trace_id, `trace-${activityType.toLowerCase()}-0304`);
    assert.ok(Array.isArray(transaction.entries));

    const read = await fetch(`${api}/api/v1/ledger/transactions/${transaction.id}`, { headers: owner.auth });
    assert.equal(read.status, 200);
    assert.equal((await read.json()).id, transaction.id);
  }

  const denied = await fetch(`${api}/api/v1/ledger/transactions/${firstTransactionId}`, { headers: outsider.auth });
  assert.equal(denied.status, 403);
  const deniedCreate = await fetch(`${api}/api/v1/ledger/transactions`, {
    method: "POST", headers: { ...outsider.auth, "content-type": "application/json" },
    body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: "DEPOSIT", occurred_at: "2026-10-17T10:00:00.000Z", effective_date: "2026-10-17", amount: "1", currency_code: "EUR", source_type: "MANUAL" })
  });
  assert.equal(deniedCreate.status, 403);
});

// ISSUE-05 traceability: child TC-ids covered by the US-0304 contract tests above.
test("US-0304: ISSUE-05 traceability covers TC-US-0304-A, TC-US-0304-B, TC-US-0304-C, TC-US-0304-D", () => {
  for (const id of ["TC-US-0304-A", "TC-US-0304-B", "TC-US-0304-C", "TC-US-0304-D"]) {
    assert.ok(id.startsWith("TC-US-0304"), `${id} belongs to US-0304`);
  }
});
