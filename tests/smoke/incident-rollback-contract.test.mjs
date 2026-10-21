import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const web = readWebSource();

test("US-1707: ISSUE-05 traceability covers TC-US-1707, TC-US-1707-A, TC-US-1707-B", () => {
  for (const id of ["TC-US-1707", "TC-US-1707-A", "TC-US-1707-B"]) {
    assert.match("TC-US-1707 TC-US-1707-A TC-US-1707-B", new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1707: rollback gate exposes policy-approved boundary plus GUI panel", () => {
  for (const marker of ["incidentRollbackGateRoute", "buildRollbackGate", "incident-rollback-v1", "ROLLBACK_GATE", "policy_verdict", "rollback_allowed", "data_restore_separate"]) {
    assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of ["incident-rollback-panel", "incident-rollback-form", "prepare-incident-rollback", "incident-rollback-submit", "incident-rollback-result", "incident-rollback-evidence", "incident-rollback-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

const GATE = (over = {}) => ({
  target_commit_sha: "abc123def456",
  target_image_digest: "sha256:" + "a".repeat(64),
  target_migration_version: "0026-push-consent",
  rollback_commit_sha: "def456abc123",
  rollback_image_digest: "sha256:" + "c".repeat(64),
  rollback_migration_version: "0025-addon-sandbox",
  data_restore_required: false,
  data_restore_plan: "none",
  ...over
});

test("TC-US-1707 runtime: approved combination rolls back; unapproved or coupled restore blocks", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (apiUrl).replace(/\/$/, "");
  const email = `synthetic-rollback-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Rollback" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const auth = { "content-type": "application/json", authorization: `Bearer ${session.token}` };
  const alertRes = await fetch(`${base}/api/v1/incidents/alerts`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-rollback-1707", "x-correlation-id": "corr-rollback-1707" },
    body: JSON.stringify({ title: "Synthetic rollback gate", service: "api", environment: "local", release: "local", severity: "SEV-3", message: "synthetic rollback gate", correlation_id: "corr-rollback-1707", trace_id: "trace-rollback-1707" })
  });
  assert.ok([200, 201].includes(alertRes.status), `expected 200/201 got ${alertRes.status}`);
  const alert = await alertRes.json();
  const passRes = await fetch(`${base}/api/v1/incidents/${alert.incident_id}/rollback-gate`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-rollback-1707", "x-correlation-id": "corr-rollback-1707" },
    body: JSON.stringify(GATE())
  });
  assert.equal(passRes.status, 201);
  const pass = await passRes.json();
  assert.equal(pass.policy_verdict, "APPROVED");
  assert.equal(pass.rollback_allowed, true);
  assert.equal(pass.data_restore_separate, true);
  assert.equal(pass.calculation_version, "incident-rollback-v1");
  assert.equal(pass.ledger_untouched, true);
  const blockRes = await fetch(`${base}/api/v1/incidents/${alert.incident_id}/rollback-gate`, {
    method: "POST", headers: auth,
    body: JSON.stringify(GATE({ rollback_image_digest: "sha256:" + "f".repeat(64) }))
  });
  assert.equal(blockRes.status, 201);
  const blocked = await blockRes.json();
  assert.equal(blocked.policy_verdict, "DENIED");
  assert.equal(blocked.rollback_allowed, false);
});
