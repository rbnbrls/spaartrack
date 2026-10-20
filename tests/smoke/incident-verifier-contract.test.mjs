import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const web = readWebSource();

test("TC-US-1705: verifier review exposes independent boundary and GUI panel", () => {
  for (const marker of ["incidentVerifierReviewRoute", "buildVerifierReview", "incident-verifier-v1", "VERIFIER_REVIEW", "coverage_verdict", "promotion_allowed"]) {
    assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of ["incident-verifier-panel", "incident-verifier-form", "prepare-incident-verifier", "incident-verifier-submit", "incident-verifier-result", "incident-verifier-evidence", "incident-verifier-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1705 runtime: independent review blocks promotion on missing tests or blocking findings", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.API_URL || "http://localhost:18080").replace(/\/$/, "");
  const email = `synthetic-verifier-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Verifier" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const auth = { "content-type": "application/json", authorization: `Bearer ${session.token}` };
  const alertRes = await fetch(`${base}/api/v1/incidents/alerts`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-verifier-1705", "x-correlation-id": "corr-verifier-1705" },
    body: JSON.stringify({ title: "Synthetic verifier review", service: "api", environment: "local", release: "local", severity: "SEV-3", message: "synthetic verifier review", correlation_id: "corr-verifier-1705", trace_id: "trace-verifier-1705" })
  });
  assert.ok([200, 201].includes(alertRes.status), `expected 200/201 got ${alertRes.status}`);
  const alert = await alertRes.json();
  const reviewRes = await fetch(`${base}/api/v1/incidents/${alert.incident_id}/verifier-review`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-verifier-1705", "x-correlation-id": "corr-verifier-1705" },
    body: JSON.stringify({ executed_tests: [{ test_id: "TC-US-1704-ledger-untouched", result: "PASS" }], missing_tests: ["TC-US-1705-ledger-untouched"], findings: [{ severity: "CRITICAL", evidence: "synthetic ledger write", owner: "security-owner", blocking: true }] })
  });
  assert.equal(reviewRes.status, 201);
  const review = await reviewRes.json();
  assert.equal(review.coverage_verdict, "FAIL");
  assert.equal(review.security_verdict, "BLOCKED");
  assert.equal(review.promotion_allowed, false);
  assert.equal(review.calculation_version, "incident-verifier-v1");
  assert.equal(review.ledger_untouched, true);
  const passRes = await fetch(`${base}/api/v1/incidents/${alert.incident_id}/verifier-review`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ executed_tests: [{ test_id: "TC-US-1705-ledger-untouched", result: "PASS" }], missing_tests: [], findings: [] })
  });
  assert.equal(passRes.status, 201);
  const pass = await passRes.json();
  assert.equal(pass.coverage_verdict, "PASS");
  assert.equal(pass.promotion_allowed, true);
});
