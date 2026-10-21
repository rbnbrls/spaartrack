import { fixtureKey } from "../helpers/fixture-key.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0607: import undo voids batch activities and keeps audit evidence", () => {
  for (const value of ["/api/v1/import-sessions/", "undo", "IMPORT_UNDO", "UNDONE", "voided_at", "correction_type", "audit_log"]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  for (const value of ["import-undo", "Undo importbatch", "undo-result", "UNDONE"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-0607-runtime: committed import batch can be undone without physical delete", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-import-undo-0607-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic import undo" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": fixtureKey() }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Undo ${suffix}`, reporting_currency_code: "EUR", privacy_scope: "PRIVATE" }) });
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic undo account", account_type: "BROKERAGE", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) });
  const account = await accountResponse.json();
  const csv = `date,action,amount,currency,provider_id\n2026-10-17,DEPOSIT,33.00,EUR,undo-${suffix}\n`;
  const preview = await fetch(`${api}/api/v1/import-validations`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, filename: `IMPORT-001-undo-${suffix}.csv`, content_type: "text/csv", content_base64: Buffer.from(csv).toString("base64") }) });
  const previewPayload = await preview.json();
  const commit = await fetch(`${api}/api/v1/import-sessions/${previewPayload.import_session_id}/commit`, { method: "POST", headers: auth, body: JSON.stringify({ financial_account_id: account.id }) });
  assert.equal(commit.status, 201);
  const commitPayload = await commit.json();
  const transactionId = commitPayload.transaction_ids[0];
  const undo = await fetch(`${api}/api/v1/import-sessions/${previewPayload.import_session_id}/undo`, { method: "POST", headers: auth, body: JSON.stringify({ reason: "Synthetic import rollback" }) });
  assert.equal(undo.status, 201);
  const undoPayload = await undo.json();
  assert.equal(undoPayload.status, "UNDONE");
  assert.equal(undoPayload.rows_undone, 1);
  assert.equal(undoPayload.transaction_ids[0], transactionId);
  const transaction = await fetch(`${api}/api/v1/ledger/transactions/${transactionId}`, { headers: { authorization: `Bearer ${token}` } });
  const transactionPayload = await transaction.json();
  assert.equal(transactionPayload.state, "VOID");
  assert.ok(transactionPayload.voided_at);
  assert.equal(transactionPayload.metadata.correction_type, "IMPORT_UNDO");
  const audit = await fetch(`${api}/api/v1/audit`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(audit.status, 200);
  assert.ok((await audit.json()).events.some((event) => event.action === "IMPORT_UNDO"));
});
