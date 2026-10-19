import test from "node:test";
import assert from "node:assert/strict";
import { buildPromotionGate } from "../../apps/api/src/incident-promotion.ts";

const ARTIFACT = {
  commit_sha: "abc123def456",
  image_digest: "sha256:" + "a".repeat(64),
  sbom_digest: "sha256:" + "b".repeat(64),
  migration_version: "0026-push-consent",
  staging_commit_sha: "abc123def456",
  staging_image_digest: "sha256:" + "a".repeat(64),
  staging_sbom_digest: "sha256:" + "b".repeat(64),
  staging_migration_version: "0026-push-consent",
  staging_result: "PASS"
};

const HEALTH = [
  { service: "api", metric: "p99_latency_ms", value: 120, threshold: 500 },
  { service: "worker", metric: "queue_age_s", value: 30, threshold: 900 },
  { service: "db", metric: "backup_age_h", value: 5, threshold: 24 },
  { service: "integration", metric: "sync_stale_min", value: 10, threshold: 60 },
  { service: "product", metric: "ledger_batch_success", value: 1, threshold: 1 }
];

test("TC-US-1706-A: artifact identity must match exactly or promotion is blocked", () => {
  const gate = buildPromotionGate({
    incident_id: "incident-1706-a", correlation_id: "corr-1706-a", trace_id: "trace-1706-a",
    ...ARTIFACT, health_checks: HEALTH
  });
  assert.equal(gate.identity_verdict, "MATCH");
  assert.equal(gate.promotion_allowed, true);
  assert.equal(gate.calculation_version, "incident-promotion-v1");
  assert.equal(gate.ledger_untouched, true);
  assert.equal(gate.read_only, true);
});

test("TC-US-1706-A-mismatch: digest mismatch blocks promotion", () => {
  const gate = buildPromotionGate({
    incident_id: "incident-1706-m", correlation_id: "c", trace_id: "t",
    ...ARTIFACT, staging_image_digest: "sha256:" + "f".repeat(64), health_checks: HEALTH
  });
  assert.equal(gate.identity_verdict, "MISMATCH");
  assert.equal(gate.promotion_allowed, false);
  assert.ok(gate.mismatches.some((m) => m.includes("image_digest")));
});

test("TC-US-1706-B: health window evaluates api/worker/db/integration/product metrics", () => {
  const gate = buildPromotionGate({
    incident_id: "incident-1706-b", correlation_id: "c", trace_id: "t",
    ...ARTIFACT,
    health_checks: HEALTH.map((h) => h.service === "db" ? { ...h, value: 99 } : h)
  });
  assert.equal(gate.health_verdict, "FAIL");
  assert.equal(gate.promotion_allowed, false);
  assert.ok(gate.health_gaps.some((g) => g.service === "db"));
});

test("TC-US-1706-validation: rejects bad sha/digest/window", () => {
  assert.throws(() => buildPromotionGate({
    incident_id: "i", correlation_id: "c", trace_id: "t",
    ...ARTIFACT, commit_sha: "bad!", health_checks: HEALTH
  }), /INVALID_PROMOTION_/);
  assert.throws(() => buildPromotionGate({
    incident_id: "i", correlation_id: "c", trace_id: "t",
    ...ARTIFACT, health_checks: [{ service: "api", metric: "x", value: 1, threshold: 2 }]
  }), /INVALID_PROMOTION_/);
});
