import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0608: reconciliation issues have a portfolio-scoped review queue", () => {
  for (const value of [
    "/api/v1/reconciliation-issues", "UNKNOWN_INSTRUMENT", "BALANCE_MISMATCH", "AMBIGUOUS_TRANSFER",
    "IN_REVIEW", "RESOLVED", "resolution", "reconciliation_issue", "RECONCILIATION_ISSUE_RESOLVED"
  ]) assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const value of ["reconciliation-panel", "reconciliation-issues", "review queue", "Resolve issue"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-0608-runtime: unknown instrument, balance mismatch and ambiguous transfer can be reviewed and resolved", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-reconciliation-0608-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic reconciliation owner" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Reconciliation ${suffix}`, reporting_currency_code: "EUR", privacy_scope: "PRIVATE" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const create = async (issue_type, message, evidence) => {
    const response = await fetch(`${api}/api/v1/reconciliation-issues`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, issue_type, severity: "WARNING", message, evidence }) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const unknown = await create("UNKNOWN_INSTRUMENT", "Synthetic symbol needs mapping", { provider_symbol: "SYNTH-UNKNOWN" });
  await create("BALANCE_MISMATCH", "Synthetic statement balance differs", { statement: "100.00", calculated: "99.50", currency: "EUR" });
  await create("AMBIGUOUS_TRANSFER", "Synthetic transfer has two possible destinations", { amount: "25.00", currency: "EUR" });
  const listed = await fetch(`${api}/api/v1/reconciliation-issues?portfolio_id=${portfolio.id}`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(listed.status, 200);
  const queue = await listed.json();
  assert.equal(queue.issues.length, 3);
  assert.deepEqual(queue.issues.map((issue) => issue.issue_type), ["UNKNOWN_INSTRUMENT", "BALANCE_MISMATCH", "AMBIGUOUS_TRANSFER"]);
  const resolved = await fetch(`${api}/api/v1/reconciliation-issues/${unknown.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ status: "RESOLVED", resolution: { action: "MAPPED_TO_CANONICAL_INSTRUMENT", instrument: "synthetic-equity" } }) });
  assert.equal(resolved.status, 200);
  const resolvedPayload = await resolved.json();
  assert.equal(resolvedPayload.status, "RESOLVED");
  assert.equal(resolvedPayload.resolution.action, "MAPPED_TO_CANONICAL_INSTRUMENT");
  const outsider = await fetch(`${api}/api/v1/reconciliation-issues?portfolio_id=${portfolio.id}`);
  assert.equal(outsider.status, 401);
  const audit = await fetch(`${api}/api/v1/audit`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(audit.status, 200);
  assert.ok((await audit.json()).events.some((event) => event.action === "RECONCILIATION_ISSUE_RESOLVED"));
});
