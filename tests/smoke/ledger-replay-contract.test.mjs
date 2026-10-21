import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const adrSource = readFileSync(new URL("docs/adr/0002-canonical-ledger.md", root), "utf8");
const api = apiUrl;

test("TC-US-0308: ledger replay is deterministic and uses the canonical source", () => {
  for (const value of ["/api/v1/ledger/replay", "calculation_version", "replay_hash", "source_payload_count", "POSTED", "VOID"]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(adrSource, /ledger_transaction en ledger_entry zijn de financiële bron van waarheid/);
  assert.match(schemaSource, /CREATE TABLE ledger_transaction/);
  assert.match(schemaSource, /CREATE TABLE ledger_entry/);
});

test("TC-US-0308-runtime: replay returns stable balances/totals and enforces portfolio isolation", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const createUser = async (label) => {
    const email = `synthetic-ledger-replay-${label}-${suffix}@example.test`;
    const created = await fetch(`${api}/api/v1/users`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, display_name: `Synthetic Replay ${label}` })
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
  const outsider = await createUser("outsider");
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST", headers: { ...owner.auth, "content-type": "application/json" },
    body: JSON.stringify({ name: "Synthetic Replay Portfolio", reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, {
    method: "POST", headers: { ...owner.auth, "content-type": "application/json" },
    body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic Replay Cash", account_type: "CASH", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" })
  });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();
  const book = async (activityType, amount, externalId) => {
    const response = await fetch(`${api}/api/v1/ledger/transactions`, {
      method: "POST", headers: { ...owner.auth, "content-type": "application/json" },
      body: JSON.stringify({
        portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: activityType,
        occurred_at: "2026-10-17T14:00:00.000Z", effective_date: "2026-10-17", amount,
        currency_code: "EUR", source_type: "MANUAL", state: "POSTED", external_id: externalId,
        description: `Synthetic replay ${activityType}`
      })
    });
    assert.equal(response.status, 201);
  };
  await book("DEPOSIT", "100", "synthetic-replay-deposit");
  await book("WITHDRAWAL", "20", "synthetic-replay-withdrawal");

  const replay = async () => fetch(`${api}/api/v1/ledger/replay`, {
    method: "POST", headers: { ...owner.auth, "content-type": "application/json" },
    body: JSON.stringify({ portfolio_id: portfolio.id })
  });
  const firstResponse = await replay();
  assert.equal(firstResponse.status, 200);
  const first = await firstResponse.json();
  assert.equal(first.calculation_version, "ledger-replay-v1");
  assert.equal(first.transaction_count, 2);
  assert.equal(first.entry_count, 2);
  assert.equal(first.source_payload_count, 0);
  assert.equal(first.balances[0].amount, "80.000000000000");
  assert.equal(first.totals[0].external_contribution_amount, "100.000000000000");
  assert.equal(first.totals[0].external_spending_amount, "20.000000000000");
  assert.match(first.replay_hash, /^[a-f0-9]{64}$/);

  const secondResponse = await replay();
  assert.equal(secondResponse.status, 200);
  const second = await secondResponse.json();
  assert.deepEqual(second.balances, first.balances);
  assert.deepEqual(second.totals, first.totals);
  assert.equal(second.replay_hash, first.replay_hash);

  const denied = await fetch(`${api}/api/v1/ledger/replay`, {
    method: "POST", headers: { ...outsider.auth, "content-type": "application/json" },
    body: JSON.stringify({ portfolio_id: portfolio.id })
  });
  assert.equal(denied.status, 403);
});
