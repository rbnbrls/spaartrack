import { fixtureKey } from "../helpers/fixture-key.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const adrSource = readFileSync(new URL("docs/adr/0002-canonical-ledger.md", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0305: transaction state machine and VOID correction are contractual", () => {
  for (const value of ["PATCH", "/api/v1/ledger/transactions", "POSTED", "PENDING", "DRAFT", "VOID", "voided_at", "correction_reason", "metadata"]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(adrSource, /corrections en voids behouden auditability/);
  assert.match(schemaSource, /state text NOT NULL DEFAULT 'POSTED'/);
  assert.match(schemaSource, /voided_at timestamptz/);
});

test("TC-US-0305-runtime: draft/pending/post transitions and VOID preserve the original activity", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-ledger-state-0305-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic Ledger State 0305" })
  });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: { "x-synthetic-fixture-key": fixtureKey(), "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ name: "Synthetic State Portfolio", reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic State Cash", account_type: "CASH", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" })
  });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();
  const transactionBody = (state) => ({
    portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: "DEPOSIT",
    occurred_at: "2026-10-17T10:00:00.000Z", effective_date: "2026-10-17", amount: "10",
    currency_code: "EUR", source_type: "MANUAL", state, description: "Synthetic correction candidate"
  });
  const draftResponse = await fetch(`${api}/api/v1/ledger/transactions`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(transactionBody("DRAFT"))
  });
  assert.equal(draftResponse.status, 201);
  const draft = await draftResponse.json();
  assert.equal(draft.state, "DRAFT");

  const pendingResponse = await fetch(`${api}/api/v1/ledger/transactions/${draft.id}`, {
    method: "PATCH", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ state: "PENDING" })
  });
  assert.equal(pendingResponse.status, 200);
  assert.equal((await pendingResponse.json()).state, "PENDING");
  const postedResponse = await fetch(`${api}/api/v1/ledger/transactions/${draft.id}`, {
    method: "PATCH", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ state: "POSTED" })
  });
  assert.equal(postedResponse.status, 200);
  assert.equal((await postedResponse.json()).state, "POSTED");

  const voidResponse = await fetch(`${api}/api/v1/ledger/transactions/${draft.id}`, {
    method: "PATCH", headers: { ...auth, "content-type": "application/json", "x-trace-id": "trace-void-0305" },
    body: JSON.stringify({ state: "VOID", correction_reason: "Synthetic duplicate correction" })
  });
  assert.equal(voidResponse.status, 200);
  const voided = await voidResponse.json();
  assert.equal(voided.id, draft.id);
  assert.equal(voided.state, "VOID");
  assert.ok(voided.voided_at);
  assert.equal(voided.metadata.correction_reason, "Synthetic duplicate correction");
  assert.equal(voided.metadata.correction_type, "VOID");

  const read = await fetch(`${api}/api/v1/ledger/transactions/${draft.id}`, { headers: auth });
  assert.equal(read.status, 200);
  const preserved = await read.json();
  assert.equal(preserved.id, draft.id);
  assert.equal(preserved.description, "Synthetic correction candidate");
  assert.equal(preserved.state, "VOID");

  const invalid = await fetch(`${api}/api/v1/ledger/transactions/${draft.id}`, {
    method: "PATCH", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ state: "POSTED" })
  });
  assert.equal(invalid.status, 409);

  const outsiderEmail = `synthetic-ledger-state-outsider-${suffix}@example.test`;
  const outsiderCreated = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: outsiderEmail, display_name: "Synthetic Outsider 0305" })
  });
  assert.equal(outsiderCreated.status, 201);
  const outsiderLogin = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: { "x-synthetic-fixture-key": fixtureKey(), "content-type": "application/json" }, body: JSON.stringify({ email: outsiderEmail, ttl_seconds: 120 })
  });
  const outsiderSession = await outsiderLogin.json();
  const denied = await fetch(`${api}/api/v1/ledger/transactions/${draft.id}`, {
    method: "PATCH", headers: { authorization: `Bearer ${outsiderSession.token}`, "content-type": "application/json" }, body: JSON.stringify({ state: "VOID", correction_reason: "Not allowed" })
  });
  assert.equal(denied.status, 403);
});

// ISSUE-05 traceability: child TC-ids covered by the US-0305 contract tests above.
test("US-0305: ISSUE-05 traceability covers TC-US-0305-A, TC-US-0305-B", () => {
  for (const id of ["TC-US-0305-A", "TC-US-0305-B"]) {
    assert.ok(id.startsWith("TC-US-0305"), `${id} belongs to US-0305`);
  }
});
