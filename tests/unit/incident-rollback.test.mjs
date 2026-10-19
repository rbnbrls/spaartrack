import test from "node:test";
import assert from "node:assert/strict";
import { buildRollbackGate } from "../../apps/api/src/incident-rollback.ts";

const POLICY = {
  target_commit_sha: "abc123def456",
  target_image_digest: "sha256:" + "a".repeat(64),
  target_migration_version: "0026-push-consent",
  rollback_commit_sha: "def456abc123",
  rollback_image_digest: "sha256:" + "c".repeat(64),
  rollback_migration_version: "0025-addon-sandbox",
  data_restore_required: false,
  data_restore_plan: "none"
};

test("TC-US-1707-A: policy-approved image/schema combination allows rollback", () => {
  const gate = buildRollbackGate({
    incident_id: "incident-1707-a", correlation_id: "corr-1707-a", trace_id: "trace-1707-a",
    ...POLICY
  });
  assert.equal(gate.policy_verdict, "APPROVED");
  assert.equal(gate.rollback_allowed, true);
  assert.equal(gate.calculation_version, "incident-rollback-v1");
  assert.equal(gate.ledger_untouched, true);
  assert.equal(gate.read_only, true);
});

test("TC-US-1707-A-unapproved: unknown combination blocks rollback", () => {
  const gate = buildRollbackGate({
    incident_id: "incident-1707-m", correlation_id: "c", trace_id: "t",
    ...POLICY, rollback_image_digest: "sha256:" + "f".repeat(64)
  });
  assert.equal(gate.policy_verdict, "DENIED");
  assert.equal(gate.rollback_allowed, false);
  assert.ok(gate.denials.some((d) => d.includes("image_digest")));
});

test("TC-US-1707-B: data restore stays separate from rollback", () => {
  const gate = buildRollbackGate({
    incident_id: "incident-1707-b", correlation_id: "c", trace_id: "t",
    ...POLICY, data_restore_required: true, data_restore_plan: "restore-local.sh --sandbox-only"
  });
  assert.equal(gate.data_restore_separate, true);
  assert.equal(gate.rollback_allowed, true);
  assert.ok(gate.data_restore_note.includes("sandbox"));
});

test("TC-US-1707-validation: rejects bad sha/digest/migration", () => {
  assert.throws(() => buildRollbackGate({
    incident_id: "i", correlation_id: "c", trace_id: "t",
    ...POLICY, target_commit_sha: "bad!"
  }), /INVALID_ROLLBACK_/);
  assert.throws(() => buildRollbackGate({
    incident_id: "i", correlation_id: "c", trace_id: "t",
    ...POLICY, rollback_migration_version: ""
  }), /INVALID_ROLLBACK_/);
});
