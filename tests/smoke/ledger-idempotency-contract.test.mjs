import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const migrationSource = readFileSync(new URL("database/migrations/0005-ledger-idempotency.sql", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0306: ledger duplicate actions use external identity or deterministic account-scoped hash", () => {
  for (const value of ["external_id", "external_hash", "idempotent", "IDEMPOTENCY_KEY_CONFLICT", "ledger_transaction_account_external_id_idx", "ledger_transaction_account_external_hash_idx"]) {
    assert.match(apiSource + schemaSource + migrationSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /CREATE TABLE ledger_transaction/);
  assert.match(migrationSource, /CREATE UNIQUE INDEX IF NOT EXISTS/);
});

test("TC-US-0306-runtime: duplicate external and fallback identities do not create a second ledger action", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-ledger-idempotency-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic Ledger Idempotency" })
  });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/sessions`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}`, "content-type": "application/json" };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST", headers: auth, body: JSON.stringify({ name: "Synthetic Idempotency Portfolio", reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const makeAccount = async (name) => {
    const response = await fetch(`${api}/api/v1/accounts`, {
      method: "POST", headers: auth,
      body: JSON.stringify({ portfolio_id: portfolio.id, name, account_type: "CASH", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" })
    });
    assert.equal(response.status, 201);
    return response.json();
  };
  const account = await makeAccount("Synthetic Idempotency Cash");
  const secondAccount = await makeAccount("Synthetic Idempotency Cash 2");
  const base = {
    portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: "DEPOSIT",
    occurred_at: "2026-10-17T12:00:00.000Z", effective_date: "2026-10-17", amount: "42.00",
    currency_code: "EUR", source_type: "IMPORT", state: "POSTED", description: "Synthetic imported deposit"
  };
  const first = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: auth, body: JSON.stringify({ ...base, external_id: "external-0306-1" }) });
  assert.equal(first.status, 201);
  const original = await first.json();
  const duplicate = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: auth, body: JSON.stringify({ ...base, external_id: "external-0306-1" }) });
  assert.equal(duplicate.status, 200);
  const duplicateBody = await duplicate.json();
  assert.equal(duplicateBody.id, original.id);
  assert.equal(duplicateBody.idempotent, true);
  assert.equal(duplicateBody.entries.length, 1);

  const sameKeyOtherAccount = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: auth, body: JSON.stringify({ ...base, financial_account_id: secondAccount.id, external_id: "external-0306-1" }) });
  assert.equal(sameKeyOtherAccount.status, 201);
  assert.notEqual((await sameKeyOtherAccount.json()).id, original.id);

  const { external_id: _externalId, ...fallbackBase } = base;
  const fallbackIdentity = { ...fallbackBase, amount: "44.00" };
  const fallback = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: auth, body: JSON.stringify({ ...fallbackIdentity, description: "Synthetic fallback deposit" }) });
  assert.equal(fallback.status, 201);
  const fallbackOriginal = await fallback.json();
  const fallbackDuplicate = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: auth, body: JSON.stringify({ ...fallbackIdentity, description: "Different description is not identity" }) });
  assert.equal(fallbackDuplicate.status, 200);
  assert.equal((await fallbackDuplicate.json()).id, fallbackOriginal.id);

  const conflicting = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: auth, body: JSON.stringify({ ...base, amount: "43.00", external_id: "external-0306-1" }) });
  assert.equal(conflicting.status, 409);
  assert.equal((await conflicting.json()).error, "IDEMPOTENCY_KEY_CONFLICT");
});
