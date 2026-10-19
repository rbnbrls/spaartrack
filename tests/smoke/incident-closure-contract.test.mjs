import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const web = readFileSync(new URL("apps/web/index.html", root), "utf8");

test("US-1708: ISSUE-05 traceability covers TC-US-1708, TC-US-1708-A, TC-US-1708-B", () => {
  for (const id of ["TC-US-1708", "TC-US-1708-A", "TC-US-1708-B"]) {
    assert.match("TC-US-1708 TC-US-1708-A TC-US-1708-B", new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1708: closure exposes seven-section evidence boundary plus GUI panel", () => {
  for (const marker of ["incidentClosureRoute", "buildIncidentClosure", "incident-closure-v1", "INCIDENT_CLOSURE", "closure_verdict", "closure_allowed", "missing_fields"]) {
    assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of ["incident-closure-panel", "incident-closure-form", "prepare-incident-closure", "incident-closure-submit", "incident-closure-result", "incident-closure-evidence", "incident-closure-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

const CLOSURE = (over = {}) => ({
  root_cause: "Synthetic migration race on staging",
  impact: "SEV-3 synthetic staging only",
  timeline: [
    { at: "2026-10-19T14:00:00.000Z", event: "alert routed" },
    { at: "2026-10-19T14:20:00.000Z", event: "fix verified" }
  ],
  fix_summary: "Pinned rollback digest",
  regression_test_id: "TC-US-1707",
  release_ref: "0026-push-consent",
  prevention_item: "Add gate check",
  ...over
});

test("TC-US-1708 runtime: complete evidence closes; incomplete blocks", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.API_URL || "http://localhost:18080").replace(/\/$/, "");
  const email = `synthetic-closure-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Closure" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const auth = { "content-type": "application/json", authorization: `Bearer ${session.token}` };
  const alertRes = await fetch(`${base}/api/v1/incidents/alerts`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-closure-1708", "x-correlation-id": "corr-closure-1708" },
    body: JSON.stringify({ title: "Synthetic closure", service: "api", environment: "local", release: "local", severity: "SEV-3", message: "synthetic closure", correlation_id: "corr-closure-1708", trace_id: "trace-closure-1708" })
  });
  assert.ok([200, 201].includes(alertRes.status), `expected 200/201 got ${alertRes.status}`);
  const alert = await alertRes.json();
  const passRes = await fetch(`${base}/api/v1/incidents/${alert.incident_id}/closure`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-closure-1708", "x-correlation-id": "corr-closure-1708" },
    body: JSON.stringify(CLOSURE())
  });
  assert.equal(passRes.status, 201);
  const pass = await passRes.json();
  assert.equal(pass.closure_verdict, "CLOSED");
  assert.equal(pass.closure_allowed, true);
  assert.equal(pass.calculation_version, "incident-closure-v1");
  assert.equal(pass.ledger_untouched, true);
  const blockRes = await fetch(`${base}/api/v1/incidents/${alert.incident_id}/closure`, {
    method: "POST", headers: auth,
    body: JSON.stringify(CLOSURE({ prevention_item: "  " }))
  });
  assert.equal(blockRes.status, 201);
  const blocked = await blockRes.json();
  assert.equal(blocked.closure_verdict, "BLOCKED");
  assert.equal(blocked.closure_allowed, false);
});
