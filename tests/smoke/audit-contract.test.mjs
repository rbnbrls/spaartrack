import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const api = apiUrl;

test("TC-US-0205: security actions have an auditable application boundary", () => {
  for (const value of ["/api/v1/audit", "audit_log", "LOGIN", "PERMISSION_CHANGE", "SECRET_ACCESS", "SHARE", "EXPORT", "REVOKE", "correlation_id", "trace_id"]) {
    assert.match(apiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /CREATE TABLE audit_log/);
  assert.match(schemaSource, /actor_type/);
  assert.match(schemaSource, /correlation_id/);
  assert.match(schemaSource, /trace_id/);
});

test("TC-US-0205-runtime: login, permission change, secret access, share, export and revoke are recorded", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-audit-0205-${suffix}@example.test`;
  const memberEmail = `synthetic-audit-member-0205-${suffix}@example.test`;
  const create = async (address, displayName) => {
    const response = await fetch(`${api}/api/v1/users`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: address, display_name: displayName })
    });
    assert.equal(response.status, 201);
    return response.json();
  };
  const user = await create(email, "Synthetic Audit Owner");
  const member = await create(memberEmail, "Synthetic Audit Member");
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST",
    headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json", "x-trace-id": "trace-audit-0205", "x-correlation-id": "corr-audit-0205" },
    body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };
  const auditLogin = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" },
    body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(auditLogin.status, 201);
  const auditToken = (await auditLogin.json()).token;

  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ name: "Synthetic Audit Portfolio", reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();

  const share = await fetch(`${api}/api/v1/portfolios/${portfolio.id}/members`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ user_id: member.id, role: "VIEWER" })
  });
  assert.equal(share.status, 201);

  const secret = await fetch(`${api}/api/v1/2fa/totp`, { method: "POST", headers: auth });
  assert.equal(secret.status, 201);

  const exportResponse = await fetch(`${api}/api/v1/users/export`, { headers: auth });
  assert.equal(exportResponse.status, 200);
  assert.equal((await exportResponse.json()).user_id, user.id);

  const logout = await fetch(`${api}/api/v1/sessions/current`, { method: "DELETE", headers: auth });
  assert.equal(logout.status, 200);

  const audit = await fetch(`${api}/api/v1/audit`, { headers: { authorization: `Bearer ${auditToken}` } });
  assert.equal(audit.status, 200);
  const actions = new Set((await audit.json()).events.map((event) => event.action));
  for (const action of ["LOGIN", "PERMISSION_CHANGE", "SECRET_ACCESS", "SHARE", "EXPORT", "REVOKE"]) {
    assert.equal(actions.has(action), true, `missing audit action ${action}`);
  }
  const loginEvent = (await fetch(`${api}/api/v1/audit`, { headers: { authorization: `Bearer ${auditToken}` } }).then((response) => response.json())).events.find((event) => event.action === "LOGIN" && event.trace_id === "trace-audit-0205");
  assert.ok(loginEvent);
  assert.equal(loginEvent.trace_id, "trace-audit-0205");
  assert.equal(loginEvent.correlation_id, "corr-audit-0205");
});
