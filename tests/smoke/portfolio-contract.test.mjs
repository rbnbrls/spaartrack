import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const adrSource = readFileSync(new URL("docs/adr/0002-canonical-ledger.md", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0301: portfolio contract exposes owner, status, privacy scope and reporting currency", () => {
  for (const value of ["/api/v1/portfolios", "owner_user_id", "reporting_currency_code", "privacy_scope", "ACTIVE", "PRIVATE"]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(adrSource, /ledger_transaction en ledger_entry zijn de financiële bron van waarheid/);
  assert.match(schemaSource, /CREATE TABLE portfolio/);
});

test("TC-US-0301-runtime: authenticated owner creates and reads a configured portfolio", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const email = `synthetic-portfolio-0301-${Date.now()}@example.test`;
  const userResponse = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic Portfolio Owner 0301" })
  });
  assert.equal(userResponse.status, 201);
  const user = await userResponse.json();
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };

  const invalid = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ name: "Invalid Portfolio", reporting_currency_code: "EURO", privacy_scope: "PRIVATE" })
  });
  assert.equal(invalid.status, 400);

  const created = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ name: "Synthetic Configured Portfolio", reporting_currency_code: "USD", privacy_scope: "SHARED" })
  });
  assert.equal(created.status, 201);
  const portfolio = await created.json();
  assert.equal(portfolio.owner_user_id, user.id);
  assert.equal(portfolio.role, "OWNER");
  assert.equal(portfolio.status, "ACTIVE");
  assert.equal(portfolio.privacy_scope, "SHARED");
  assert.equal(portfolio.reporting_currency_code, "USD");

  const read = await fetch(`${api}/api/v1/portfolios/${portfolio.id}`, { headers: auth });
  assert.equal(read.status, 200);
  const readBack = await read.json();
  assert.equal(readBack.owner_user_id, user.id);
  assert.equal(readBack.privacy_scope, "SHARED");
  assert.equal(readBack.reporting_currency_code, "USD");
});
