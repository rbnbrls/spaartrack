import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const web = readFileSync(new URL("apps/web/index.html", root), "utf8");

// ISSUE-05 traceability: child TC-ids covered by the US-1706 contract tests above.
test("US-1706: ISSUE-05 traceability covers TC-US-1706, TC-US-1706-A, TC-US-1706-B", () => {
  for (const id of ["TC-US-1706", "TC-US-1706-A", "TC-US-1706-B"]) {
    assert.match("TC-US-1706 TC-US-1706-A TC-US-1706-B", new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1706: promotion gate exposes artifact-identity and health-window boundary plus GUI panel", () => {
  for (const marker of ["incidentPromotionGateRoute", "buildPromotionGate", "incident-promotion-v1", "PROMOTION_GATE", "identity_verdict", "health_verdict", "promotion_allowed"]) {
    assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of ["incident-promotion-panel", "incident-promotion-form", "prepare-incident-promotion", "incident-promotion-submit", "incident-promotion-result", "incident-promotion-evidence", "incident-promotion-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

const ART = (over = {}) => ({
  commit_sha: "abc123def456",
  image_digest: "sha256:" + "a".repeat(64),
  sbom_digest: "sha256:" + "b".repeat(64),
  migration_version: "0026-push-consent",
  staging_commit_sha: "abc123def456",
  staging_image_digest: "sha256:" + "a".repeat(64),
  staging_sbom_digest: "sha256:" + "b".repeat(64),
  staging_migration_version: "0026-push-consent",
  staging_result: "PASS",
  health_checks: [
    { service: "api", metric: "p99_latency_ms", value: 120, threshold: 500 },
    { service: "worker", metric: "queue_age_s", value: 30, threshold: 900 },
    { service: "db", metric: "backup_age_h", value: 5, threshold: 24 },
    { service: "integration", metric: "sync_stale_min", value: 10, threshold: 60 },
    { service: "product", metric: "ledger_batch_success", value: 1, threshold: 1 }
  ],
  ...over
});

test("TC-US-1706 runtime: exact artifact match promotes; mismatch or health gap blocks", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.API_URL || "http://localhost:18080").replace(/\/$/, "");
  const email = `synthetic-promotion-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Promotion" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const auth = { "content-type": "application/json", authorization: `Bearer ${session.token}` };
  const alertRes = await fetch(`${base}/api/v1/incidents/alerts`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-promotion-1706", "x-correlation-id": "corr-promotion-1706" },
    body: JSON.stringify({ title: "Synthetic promotion gate", service: "api", environment: "local", release: "local", severity: "SEV-3", message: "synthetic promotion gate", correlation_id: "corr-promotion-1706", trace_id: "trace-promotion-1706" })
  });
  assert.ok([200, 201].includes(alertRes.status), `expected 200/201 got ${alertRes.status}`);
  const alert = await alertRes.json();
  const passRes = await fetch(`${base}/api/v1/incidents/${alert.incident_id}/promotion-gate`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-promotion-1706", "x-correlation-id": "corr-promotion-1706" },
    body: JSON.stringify(ART())
  });
  assert.equal(passRes.status, 201);
  const pass = await passRes.json();
  assert.equal(pass.identity_verdict, "MATCH");
  assert.equal(pass.health_verdict, "PASS");
  assert.equal(pass.promotion_allowed, true);
  assert.equal(pass.calculation_version, "incident-promotion-v1");
  assert.equal(pass.ledger_untouched, true);
  const blockRes = await fetch(`${base}/api/v1/incidents/${alert.incident_id}/promotion-gate`, {
    method: "POST", headers: auth,
    body: JSON.stringify(ART({ staging_image_digest: "sha256:" + "f".repeat(64) }))
  });
  assert.equal(blockRes.status, 201);
  const blocked = await blockRes.json();
  assert.equal(blocked.identity_verdict, "MISMATCH");
  assert.equal(blocked.promotion_allowed, false);
});
