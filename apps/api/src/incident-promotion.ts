import { createHash } from "node:crypto";

export interface PromotionHealthCheck {
  service: "api" | "worker" | "db" | "integration" | "product";
  metric: string;
  value: number;
  threshold: number;
}

export interface PromotionGateInput {
  incident_id: string;
  correlation_id: string;
  trace_id: string;
  commit_sha: string;
  image_digest: string;
  sbom_digest: string;
  migration_version: string;
  staging_commit_sha: string;
  staging_image_digest: string;
  staging_sbom_digest: string;
  staging_migration_version: string;
  staging_result: string;
  health_checks: PromotionHealthCheck[];
}

const REQUIRED_SERVICES = ["api", "worker", "db", "integration", "product"] as const;

function requiredText(value: unknown, name: string, pattern: RegExp): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || !pattern.test(text)) throw new Error(`INVALID_PROMOTION_${name.toUpperCase()}`);
  return text;
}

export function buildPromotionGate(input: PromotionGateInput) {
  const incidentId = requiredText(input.incident_id, "incident_id", /^[\w-]{1,120}$/);
  const correlationId = requiredText(input.correlation_id, "correlation_id", /^.{1,240}$/);
  const traceId = requiredText(input.trace_id, "trace_id", /^.{1,240}$/);
  const commitSha = requiredText(input.commit_sha, "commit_sha", /^[0-9a-f]{6,64}$/i);
  const imageDigest = requiredText(input.image_digest, "image_digest", /^sha256:[0-9a-f]{64}$/i);
  const sbomDigest = requiredText(input.sbom_digest, "sbom_digest", /^sha256:[0-9a-f]{64}$/i);
  const migrationVersion = requiredText(input.migration_version, "migration_version", /^[\w.-]{1,120}$/);
  const stagingCommit = requiredText(input.staging_commit_sha, "staging_commit_sha", /^[0-9a-f]{6,64}$/i);
  const stagingImage = requiredText(input.staging_image_digest, "staging_image_digest", /^sha256:[0-9a-f]{64}$/i);
  const stagingSbom = requiredText(input.staging_sbom_digest, "staging_sbom_digest", /^sha256:[0-9a-f]{64}$/i);
  const stagingMigration = requiredText(input.staging_migration_version, "staging_migration_version", /^[\w.-]{1,120}$/);
  const stagingResult = requiredText(input.staging_result, "staging_result", /^(PASS|FAIL)$/);
  const checks = Array.isArray(input.health_checks) ? input.health_checks : null;
  if (!checks) throw new Error("INVALID_PROMOTION_HEALTH_CHECKS");
  const services = checks.map((c) => c.service);
  for (const s of REQUIRED_SERVICES) {
    if (!services.includes(s)) throw new Error("INVALID_PROMOTION_HEALTH_WINDOW");
  }
  for (const c of checks) {
    if (!REQUIRED_SERVICES.includes(c.service as never)) throw new Error("INVALID_PROMOTION_HEALTH_SERVICE");
    if (typeof c.metric !== "string" || !c.metric.trim()) throw new Error("INVALID_PROMOTION_HEALTH_METRIC");
    if (typeof c.value !== "number" || typeof c.threshold !== "number") throw new Error("INVALID_PROMOTION_HEALTH_VALUE");
  }
  const mismatches: string[] = [];
  if (commitSha.toLowerCase() !== stagingCommit.toLowerCase()) mismatches.push("commit_sha");
  if (imageDigest.toLowerCase() !== stagingImage.toLowerCase()) mismatches.push("image_digest");
  if (sbomDigest.toLowerCase() !== stagingSbom.toLowerCase()) mismatches.push("sbom_digest");
  if (migrationVersion !== stagingMigration) mismatches.push("migration_version");
  if (stagingResult !== "PASS") mismatches.push("staging_result");
  const identityVerdict = mismatches.length === 0 ? "MATCH" : "MISMATCH";
  const healthGaps = checks.filter((c) => c.value > c.threshold).map((c) => ({ service: c.service, metric: c.metric, value: c.value, threshold: c.threshold }));
  const healthVerdict = healthGaps.length === 0 ? "PASS" : "FAIL";
  const promotionAllowed = identityVerdict === "MATCH" && healthVerdict === "PASS";
  const reproducibilityKey = createHash("sha256")
    .update(JSON.stringify({ commitSha, imageDigest, sbomDigest, migrationVersion, stagingCommit, stagingImage, stagingSbom, stagingMigration, stagingResult, checks }))
    .digest("hex");
  return {
    incident_id: incidentId, correlation_id: correlationId, trace_id: traceId,
    commit_sha: commitSha, image_digest: imageDigest, sbom_digest: sbomDigest,
    migration_version: migrationVersion, identity_verdict: identityVerdict, mismatches,
    health_verdict: healthVerdict, health_gaps: healthGaps,
    promotion_allowed: promotionAllowed, reproducibility_key: reproducibilityKey,
    calculation_version: "incident-promotion-v1",
    ledger_untouched: true as const, read_only: true as const
  };
}
