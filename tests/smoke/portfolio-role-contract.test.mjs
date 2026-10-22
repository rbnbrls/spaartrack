import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const api = apiUrl;

test("TC-US-0204: portfolio roles are explicit and enforced server-side", () => {
  for (const value of ["/api/v1/portfolios", "portfolio_member", "OWNER", "EDITOR", "VIEWER", "ACCOUNTANT", "ADVISOR", "403"]) {
    assert.match(apiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /CREATE TABLE portfolio_member/);
  assert.match(schemaSource, /role text NOT NULL CHECK \(role IN \('OWNER', 'EDITOR', 'VIEWER', 'ACCOUNTANT', 'ADVISOR'\)\)/);
});

async function createUser(label) {
  const email = `synthetic-role-0204-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const response = await fetch(`${api}/api/v1/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: `Synthetic Role ${label}` })
  });
  assert.equal(response.status, 201);
  const user = await response.json();
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST",
    headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" },
    body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  return { ...user, headers: { authorization: `Bearer ${session.token}` } };
}

test("TC-US-0204-runtime: owner, role reads/writes, member management and isolation", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const owner = await createUser("owner");
  const editor = await createUser("editor");
  const viewer = await createUser("viewer");
  const accountant = await createUser("accountant");
  const advisor = await createUser("advisor");
  const outsider = await createUser("outsider");

  const created = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST",
    headers: { ...owner.headers, "content-type": "application/json" },
    body: JSON.stringify({ name: "Synthetic Role Portfolio", reporting_currency_code: "EUR" })
  });
  assert.equal(created.status, 201);
  const portfolio = await created.json();
  assert.equal(portfolio.role, "OWNER");

  for (const [user, role] of [[editor, "EDITOR"], [viewer, "VIEWER"], [accountant, "ACCOUNTANT"], [advisor, "ADVISOR"]]) {
    const member = await fetch(`${api}/api/v1/portfolios/${portfolio.id}/members`, {
      method: "POST",
      headers: { ...owner.headers, "content-type": "application/json" },
      body: JSON.stringify({ user_id: user.id, role })
    });
    assert.equal(member.status, 201);
    assert.equal((await member.json()).role, role);
  }

  for (const user of [owner, editor, viewer, accountant, advisor]) {
    const read = await fetch(`${api}/api/v1/portfolios/${portfolio.id}`, { headers: user.headers });
    assert.equal(read.status, 200);
  }
  const deniedRead = await fetch(`${api}/api/v1/portfolios/${portfolio.id}`, { headers: outsider.headers });
  assert.equal(deniedRead.status, 403);

  for (const user of [owner, editor]) {
    const update = await fetch(`${api}/api/v1/portfolios/${portfolio.id}`, {
      method: "PATCH",
      headers: { ...user.headers, "content-type": "application/json" },
      body: JSON.stringify({ name: `${user.id === owner.id ? "Owner" : "Editor"} renamed portfolio` })
    });
    assert.equal(update.status, 200);
  }
  for (const user of [viewer, accountant, advisor, outsider]) {
    const update = await fetch(`${api}/api/v1/portfolios/${portfolio.id}`, {
      method: "PATCH",
      headers: { ...user.headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Unauthorized rename" })
    });
    assert.equal(update.status, 403);
  }

  const editorMemberChange = await fetch(`${api}/api/v1/portfolios/${portfolio.id}/members`, {
    method: "POST",
    headers: { ...editor.headers, "content-type": "application/json" },
    body: JSON.stringify({ user_id: outsider.id, role: "VIEWER" })
  });
  assert.equal(editorMemberChange.status, 403);
});
