import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0606: import commit is atomic and returns counts", () => {
  for (const value of [
    "/api/v1/import-sessions/", "commit", "IMPORT_COMMIT_BLOCKED", "rows_committed", "rows_blocked",
    "import_session_id", "source_type", "IMPORT", "ledger_transaction"
  ]) assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const value of ["import-commit", "Import commit", "commit-result", "COMMITTED"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-0606-runtime: blocking row prevents partial ledger commit, valid batch commits with counts", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-import-commit-0606-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic import committer" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Commit ${suffix}`, reporting_currency_code: "EUR", privacy_scope: "PRIVATE" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic import account", account_type: "BROKERAGE", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();
  const preview = async (name, csv) => {
    const response = await fetch(`${api}/api/v1/import-validations`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, filename: name, content_type: "text/csv", content_base64: Buffer.from(csv).toString("base64") }) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const blocked = await preview(`IMPORT-001-blocked-${suffix}.csv`, "date,action,amount,currency\n2026-10-17,DEPOSIT,25.00,EUR\n2026-10-17,DEPOSIT,not-a-number,EUR\n");
  const blockedCommit = await fetch(`${api}/api/v1/import-sessions/${blocked.import_session_id}/commit`, { method: "POST", headers: auth, body: JSON.stringify({ financial_account_id: account.id }) });
  assert.equal(blockedCommit.status, 409);
  const blockedPayload = await blockedCommit.json();
  assert.equal(blockedPayload.error, "IMPORT_COMMIT_BLOCKED");
  assert.equal(blockedPayload.rows_blocked, 1);
  const replayAfterBlocked = await fetch(`${api}/api/v1/ledger/replay`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id }) });
  assert.equal((await replayAfterBlocked.json()).transaction_count, 0);

  const valid = await preview(`IMPORT-001-valid-${suffix}.csv`, `date,action,amount,currency,provider_id\n2026-10-17,DEPOSIT,25.00,EUR,commit-${suffix}\n`);
  const commit = await fetch(`${api}/api/v1/import-sessions/${valid.import_session_id}/commit`, { method: "POST", headers: auth, body: JSON.stringify({ financial_account_id: account.id }) });
  assert.equal(commit.status, 201);
  const result = await commit.json();
  assert.equal(result.status, "COMMITTED");
  assert.equal(result.rows_seen, 1);
  assert.equal(result.rows_committed, 1);
  assert.equal(result.rows_blocked, 0);
  assert.equal(result.rows_skipped, 0);
  assert.equal(result.transaction_ids.length, 1);
  const transaction = await fetch(`${api}/api/v1/ledger/transactions/${result.transaction_ids[0]}`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(transaction.status, 200);
  const transactionPayload = await transaction.json();
  assert.equal(transactionPayload.source_type, "IMPORT");
  assert.equal(transactionPayload.import_session_id, valid.import_session_id);
});
