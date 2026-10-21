import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const web = readWebSource();

test("TC-US-1704: fix verification exposes fail-first boundary and GUI panel", () => {
  for (const marker of ["incidentFixVerificationRoute", "buildFixVerification", "incident-fix-verification-v1", "FIX_VERIFICATION", "old_result", "new_result"]) {
    assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of ["incident-fix-panel", "incident-fix-form", "prepare-incident-fix", "incident-fix-submit", "incident-fix-result", "incident-fix-evidence", "incident-fix-verification-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1704 runtime: fail-first verification is recorded without ledger mutation", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (apiUrl).replace(/\/$/, "");
  const email = `synthetic-fix-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Fix" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const auth = { "content-type": "application/json", authorization: `Bearer ${session.token}` };
  const alertRes = await fetch(`${base}/api/v1/incidents/alerts`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-fix-1704", "x-correlation-id": "corr-fix-1704" },
    body: JSON.stringify({ title: "Synthetic fix verification", service: "api", environment: "local", release: "local", severity: "SEV-3", message: "synthetic fix verification", correlation_id: "corr-fix-1704", trace_id: "trace-fix-1704" })
  });
  assert.ok([200, 201].includes(alertRes.status), `expected 200/201 got ${alertRes.status}`);
  const alert = await alertRes.json();
  const verifyRes = await fetch(`${base}/api/v1/incidents/${alert.incident_id}/fix-verification`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-fix-1704", "x-correlation-id": "corr-fix-1704" },
    body: JSON.stringify({ regression_test: "TC-US-1704-ledger-untouched", old_commit: "abc123old", old_result: "FAIL", new_commit: "def456new", new_result: "PASS", minimal_fix: "Guard ledger write with read-only check." })
  });
  assert.equal(verifyRes.status, 201);
  const verification = await verifyRes.json();
  assert.equal(verification.old_result, "FAIL");
  assert.equal(verification.new_result, "PASS");
  assert.equal(verification.calculation_version, "incident-fix-verification-v1");
  assert.equal(verification.ledger_untouched, true);
  const invalidRes = await fetch(`${base}/api/v1/incidents/${alert.incident_id}/fix-verification`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ regression_test: "TC-US-1704-x", old_commit: "a", old_result: "PASS", new_commit: "b", new_result: "PASS", minimal_fix: "x" })
  });
  assert.equal(invalidRes.status, 400);
});
