import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/portfolio-share-links.ts", root), "utf8");
const web = readWebSource();
const schema = readFileSync(new URL("database/schema.sql", root), "utf8");

test("TC-US-1501: read-only portfolio link exposes access id, scope, policy, expiry and revoke", () => {
  for (const marker of ["portfolioShareLinkRoute", "buildPortfolioShareLink", "portfolio-share-link-v1", "portfolio_share_link", "access_id", "exposure_policy", "revoked_at", "trace_id", "correlation_id"]) {
    assert.match(api + kernel, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of ["portfolio-share-links-panel", "portfolio-share-links-form", "prepare-portfolio-share-links", "portfolio-share-links-submit", "portfolio-share-links-result", "portfolio-share-links-evidence", "portfolio-share-link-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(schema, /CHECK \(scope IN \('RESTRICTED_VIEW', 'VIEW'\)\)/);
});

test("TC-US-1501 runtime: owner creates, reads, resolves and revokes a read-only link", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.API_URL || "http://localhost:18080").replace(/\/$/, "");
  const email = `synthetic-share-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Share" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const auth = { "content-type": "application/json", authorization: `Bearer ${session.token}` };
  const portfolioRes = await fetch(`${base}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: "Synthetic Share Portfolio", reporting_currency_code: "EUR" }) });
  assert.equal(portfolioRes.status, 201);
  const portfolio = await portfolioRes.json();
  const createRes = await fetch(`${base}/api/v1/portfolios/${portfolio.id}/share-links`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-share-1501", "x-correlation-id": "corr-share-1501" },
    body: JSON.stringify({ scope: "VIEW", exposure_policy: { hide_amounts: false }, expires_at: "2030-12-31T00:00:00.000Z" })
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.match(created.access_id, /./);
  assert.equal(created.scope, "VIEW");
  assert.equal(created.read_only, true);
  assert.match(createRes.headers.get("x-trace-id") || "", /trace-share-1501/);
  const listRes = await fetch(`${base}/api/v1/portfolios/${portfolio.id}/share-links`, { headers: auth });
  assert.equal(listRes.status, 200);
  const listed = await listRes.json();
  assert.equal(listed.count, 1);
  const resolveRes = await fetch(`${base}/api/v1/shared/${created.access_id}`);
  assert.equal(resolveRes.status, 200);
  const resolved = await resolveRes.json();
  assert.equal(resolved.portfolio_id, portfolio.id);
  const revokeRes = await fetch(`${base}/api/v1/share-links/${created.id}/revoke`, { method: "POST", headers: auth });
  assert.equal(revokeRes.status, 200);
  const revoked = await revokeRes.json();
  assert.equal(revoked.status, "REVOKED");
  const afterRevoke = await fetch(`${base}/api/v1/shared/${created.access_id}`);
  assert.equal(afterRevoke.status, 410);
});
