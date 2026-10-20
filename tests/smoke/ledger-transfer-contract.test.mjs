import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const adrSource = readFileSync(new URL("docs/adr/0002-canonical-ledger.md", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0307: paired transfers are contractual and contribution-neutral", () => {
  for (const value of ["TRANSFER_IN", "TRANSFER_OUT", "paired_transaction_id", "destination_financial_account_id", "is_external_flow"]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(adrSource, /ledger_transaction en ledger_entry zijn de financiële bron van waarheid/);
  assert.match(schemaSource, /paired_transaction_id uuid REFERENCES ledger_transaction/);
  assert.match(schemaSource, /is_external_flow boolean NOT NULL DEFAULT true/);
});

test("TC-US-0307-runtime: transfer creates paired source/destination activities without external flow", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const createUser = async (label) => {
    const email = `synthetic-ledger-transfer-${label}-${suffix}@example.test`;
    const created = await fetch(`${api}/api/v1/users`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, display_name: `Synthetic Transfer ${label}` })
    });
    assert.equal(created.status, 201);
    const user = await created.json();
    const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
      method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 })
    });
    assert.equal(login.status, 201);
    const session = await login.json();
    return { ...user, auth: { authorization: `Bearer ${session.token}` } };
  };

  const owner = await createUser("owner");
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST", headers: { ...owner.auth, "content-type": "application/json" },
    body: JSON.stringify({ name: "Synthetic Transfer Portfolio", reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const makeAccount = async (name) => {
    const response = await fetch(`${api}/api/v1/accounts`, {
      method: "POST", headers: { ...owner.auth, "content-type": "application/json" },
      body: JSON.stringify({ portfolio_id: portfolio.id, name, account_type: "CASH", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" })
    });
    assert.equal(response.status, 201);
    return response.json();
  };
  const source = await makeAccount("Synthetic Transfer Source");
  const destination = await makeAccount("Synthetic Transfer Destination");
  const transferResponse = await fetch(`${api}/api/v1/ledger/transactions`, {
    method: "POST",
    headers: { ...owner.auth, "content-type": "application/json", "x-trace-id": "trace-transfer-0307" },
    body: JSON.stringify({
      portfolio_id: portfolio.id, financial_account_id: source.id, destination_financial_account_id: destination.id,
      activity_type: "TRANSFER_OUT", occurred_at: "2026-10-17T13:00:00.000Z", effective_date: "2026-10-17",
      amount: "25.50", currency_code: "EUR", source_type: "MANUAL", state: "POSTED",
      external_id: "synthetic-transfer-0307", description: "Synthetic internal transfer"
    })
  });
  assert.equal(transferResponse.status, 201);
  const transfer = await transferResponse.json();
  assert.equal(transfer.activity_type, "TRANSFER_OUT");
  assert.equal(transfer.financial_account_id, source.id);
  assert.equal(transfer.is_external_flow, false);
  assert.ok(transfer.paired_transaction_id);
  assert.equal(transfer.entries[0].direction, "DEBIT");
  assert.equal(transfer.trace_id, "trace-transfer-0307");

  const pairedResponse = await fetch(`${api}/api/v1/ledger/transactions/${transfer.paired_transaction_id}`, { headers: owner.auth });
  assert.equal(pairedResponse.status, 200);
  const paired = await pairedResponse.json();
  assert.equal(paired.activity_type, "TRANSFER_IN");
  assert.equal(paired.financial_account_id, destination.id);
  assert.equal(paired.paired_transaction_id, transfer.id);
  assert.equal(paired.is_external_flow, false);
  assert.equal(paired.entries[0].direction, "CREDIT");
  assert.equal(Number(paired.amount), 25.5);

  const missingDestination = await fetch(`${api}/api/v1/ledger/transactions`, {
    method: "POST", headers: { ...owner.auth, "content-type": "application/json" },
    body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: source.id, activity_type: "TRANSFER_OUT", occurred_at: "2026-10-17T13:00:00.000Z", effective_date: "2026-10-17", amount: "1", currency_code: "EUR", source_type: "MANUAL" })
  });
  assert.equal(missingDestination.status, 400);
  assert.equal((await missingDestination.json()).error, "TRANSFER_DESTINATION_REQUIRED");
});
