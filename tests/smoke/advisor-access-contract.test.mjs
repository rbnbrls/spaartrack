import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const web = readWebSource();

test("TC-US-1503: advisor access contract reuses scoped, expiring, auditable shares", () => {
  for (const marker of ["accountantShareRoute", "ACCOUNTANT_SHARE", "PORTFOLIO_OWNER_REQUIRED", "REVOKE", "accountant-access-v1", "ADVISOR"]) {
    assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of ["accountant-access-panel", "access-role", "access-scope", "access-expires", "access-revoke", "accountant-access-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1503 runtime: advisor grant is scoped, expires, audits and revokes immediately", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.API_URL || "http://localhost:18080").replace(/\/$/, "");
  const email = `synthetic-advisor-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Advisor Owner" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const auth = { "content-type": "application/json", authorization: `Bearer ${session.token}` };
  const portfolioRes = await fetch(`${base}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: "Synthetic Advisor Portfolio", reporting_currency_code: "EUR" }) });
  assert.equal(portfolioRes.status, 201);
  const portfolio = await portfolioRes.json();
  const createRes = await fetch(`${base}/api/v1/portfolios/${portfolio.id}/accountant-shares`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-advisor-1503", "x-correlation-id": "corr-advisor-1503" },
    body: JSON.stringify({ grantee_email: "advisor@example.test", role: "ADVISOR", scope: ["PORTFOLIO_READ"], expires_at: "2030-12-31T00:00:00.000Z" })
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.role, "ADVISOR");
  assert.deepEqual(created.scope, ["PORTFOLIO_READ"]);
  assert.equal(created.status, "ACTIVE");
  assert.match(createRes.headers.get("x-trace-id") || "", /trace-advisor-1503/);
  const listRes = await fetch(`${base}/api/v1/portfolios/${portfolio.id}/accountant-shares`, { headers: auth });
  assert.equal(listRes.status, 200);
  const listed = await listRes.json();
  assert.ok(listed.shares.length >= 1);
  const revokeRes = await fetch(`${base}/api/v1/accountant-shares/${created.id}/revoke`, { method: "POST", headers: auth });
  assert.equal(revokeRes.status, 200);
  const revoked = await revokeRes.json();
  assert.equal(revoked.status, "REVOKED");
  assert.equal(revoked.audit_action, "REVOKE");
  const afterRes = await fetch(`${base}/api/v1/portfolios/${portfolio.id}/accountant-shares`, { headers: auth });
  assert.equal(afterRes.status, 200);
  const after = await afterRes.json();
  const found = after.shares.find((s) => s.id === created.id);
  assert.equal(found.status, "REVOKED");
});
