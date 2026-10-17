import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const migrationSource = readFileSync(new URL("database/migrations/0004-privacy-grant-revoke.sql", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0206: privacy export and deletion use soft-delete and revoke boundaries", () => {
  for (const value of ["/api/v1/users/export", "/api/v1/users/me", "DELETED", "revoked_at", "portfolio_member"]) {
    assert.match(apiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /CREATE TABLE portfolio_member/);
  assert.match(schemaSource, /revoked_at/);
  assert.match(migrationSource, /ALTER TABLE.*portfolio_member/i);
  assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS revoked_at/i);
});

test("TC-US-0206-runtime: export contains owned data/grants and deletion revokes access without physical delete", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-privacy-0206-${suffix}@example.test`;
  const memberEmail = `synthetic-privacy-member-0206-${suffix}@example.test`;
  const create = async (address, displayName) => {
    const response = await fetch(`${api}/api/v1/users`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: address, display_name: displayName })
    });
    assert.equal(response.status, 201);
    return response.json();
  };
  const user = await create(email, "Synthetic Privacy Owner");
  const member = await create(memberEmail, "Synthetic Privacy Member");
  const login = await fetch(`${api}/api/v1/sessions`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };

  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ name: "Synthetic Privacy Portfolio", reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const grant = await fetch(`${api}/api/v1/portfolios/${portfolio.id}/members`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ user_id: member.id, role: "ADVISOR" })
  });
  assert.equal(grant.status, 201);

  const exported = await fetch(`${api}/api/v1/users/export`, { headers: auth });
  assert.equal(exported.status, 200);
  const bundle = await exported.json();
  assert.equal(bundle.user_id, user.id);
  assert.equal(bundle.portfolios.some((item) => item.id === portfolio.id), true);
  assert.equal(bundle.grants.some((item) => item.portfolio_id === portfolio.id && item.role === "OWNER"), true);
  assert.ok(Array.isArray(bundle.ledger));
  assert.ok(Array.isArray(bundle.raw_payloads));
  assert.ok(Array.isArray(bundle.reports));

  const deleted = await fetch(`${api}/api/v1/users/me`, { method: "DELETE", headers: auth });
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).status, "DELETED");

  const sessionAfterDelete = await fetch(`${api}/api/v1/sessions/me`, { headers: auth });
  assert.equal(sessionAfterDelete.status, 401);
  const loginAfterDelete = await fetch(`${api}/api/v1/sessions`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(loginAfterDelete.status, 401);

  const dbEvidence = await fetch(`${api}/api/v1/users/${user.id}`);
  assert.equal(dbEvidence.status, 200);
  const deletedUser = await dbEvidence.json();
  assert.equal(deletedUser.status, "DELETED");
  assert.ok(deletedUser.deleted_at);
});
