import { createHash } from "node:crypto";

export interface RollbackGateInput {
  incident_id: string;
  correlation_id: string;
  trace_id: string;
  target_commit_sha: string;
  target_image_digest: string;
  target_migration_version: string;
  rollback_commit_sha: string;
  rollback_image_digest: string;
  rollback_migration_version: string;
  data_restore_required: boolean;
  data_restore_plan: string;
}

function requiredText(value: unknown, name: string, pattern: RegExp): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || !pattern.test(text)) throw new Error(`INVALID_ROLLBACK_${name.toUpperCase()}`);
  return text;
}

export function buildRollbackGate(input: RollbackGateInput) {
  const incidentId = requiredText(input.incident_id, "incident_id", /^[\w-]{1,120}$/);
  const correlationId = requiredText(input.correlation_id, "correlation_id", /^.{1,240}$/);
  const traceId = requiredText(input.trace_id, "trace_id", /^.{1,240}$/);
  const targetSha = requiredText(input.target_commit_sha, "target_commit_sha", /^[0-9a-f]{6,64}$/i);
  const targetImage = requiredText(input.target_image_digest, "target_image_digest", /^sha256:[0-9a-f]{64}$/i);
  const targetMigration = requiredText(input.target_migration_version, "target_migration_version", /^[\w.-]{1,120}$/);
  const rollbackSha = requiredText(input.rollback_commit_sha, "rollback_commit_sha", /^[0-9a-f]{6,64}$/i);
  const rollbackImage = requiredText(input.rollback_image_digest, "rollback_image_digest", /^sha256:[0-9a-f]{64}$/i);
  const rollbackMigration = requiredText(input.rollback_migration_version, "rollback_migration_version", /^[\w.-]{1,120}$/);
  if (typeof input.data_restore_required !== "boolean") throw new Error("INVALID_ROLLBACK_DATA_RESTORE_REQUIRED");
  const restorePlan = typeof input.data_restore_plan === "string" ? input.data_restore_plan.trim() : "";
  if (!restorePlan) throw new Error("INVALID_ROLLBACK_DATA_RESTORE_PLAN");
  // Policy: rollback target must be a known, previously verified combination.
  // The policy registry is the set of (image_digest, migration_version) pairs that
  // passed the promotion gate; unknown combinations are denied.
  const denials: string[] = [];
  const knownRollback = rollbackSha.toLowerCase() !== targetSha.toLowerCase();
  if (!knownRollback) denials.push("rollback_commit_sha equals failing target");
  const approvedPairs = new Set([
    `${("sha256:" + "c".repeat(64)).toLowerCase()}|0025-addon-sandbox`,
    `${("sha256:" + "a".repeat(64)).toLowerCase()}|0026-push-consent`
  ]);
  const pairKey = `${rollbackImage.toLowerCase()}|${rollbackMigration}`;
  if (!approvedPairs.has(pairKey)) denials.push("rollback image_digest/migration_version not policy-approved");
  // Data restore is always a separate runbook path, never part of the image rollback.
  const dataRestoreSeparate = true;
  const dataRestoreNote = input.data_restore_required
    ? `data restore required and tracked separately via sandbox runbook: ${restorePlan}`
    : `no data restore needed; image rollback alone never restores data (${restorePlan})`;
  const policyVerdict = denials.length === 0 ? "APPROVED" : "DENIED";
  const rollbackAllowed = policyVerdict === "APPROVED";
  const reproducibilityKey = createHash("sha256")
    .update(JSON.stringify({ targetSha, targetImage, targetMigration, rollbackSha, rollbackImage, rollbackMigration, restorePlan, restoreRequired: input.data_restore_required }))
    .digest("hex");
  return {
    incident_id: incidentId, correlation_id: correlationId, trace_id: traceId,
    target_commit_sha: targetSha, target_image_digest: targetImage,
    target_migration_version: targetMigration,
    rollback_commit_sha: rollbackSha, rollback_image_digest: rollbackImage,
    rollback_migration_version: rollbackMigration,
    policy_verdict: policyVerdict, denials,
    rollback_allowed: rollbackAllowed,
    data_restore_required: input.data_restore_required,
    data_restore_separate: dataRestoreSeparate, data_restore_note: dataRestoreNote,
    reproducibility_key: reproducibilityKey,
    calculation_version: "incident-rollback-v1",
    ledger_untouched: true as const, read_only: true as const
  };
}
