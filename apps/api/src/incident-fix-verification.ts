import { createHash } from "node:crypto";

export interface FixVerificationInput {
  incident_id: string;
  correlation_id: string;
  trace_id: string;
  regression_test: string;
  old_commit: string;
  old_result: string;
  new_commit: string;
  new_result: string;
  minimal_fix: string;
}

function requiredText(value: unknown, name: string, max = 240): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > max) throw new Error(`INVALID_FIX_VERIFICATION_${name.toUpperCase()}`);
  return text;
}

export function buildFixVerification(input: FixVerificationInput): FixVerificationInput & {
  calculation_version: "incident-fix-verification-v1";
  reproducibility_key: string;
  ledger_untouched: true;
  read_only: true;
} {
  const incidentId = requiredText(input.incident_id, "incident_id");
  const correlationId = requiredText(input.correlation_id, "correlation_id");
  const traceId = requiredText(input.trace_id, "trace_id");
  const regressionTest = requiredText(input.regression_test, "regression_test");
  const oldCommit = requiredText(input.old_commit, "old_commit", 80);
  const newCommit = requiredText(input.new_commit, "new_commit", 80);
  const minimalFix = requiredText(input.minimal_fix, "minimal_fix", 500);
  const oldResult = String(input.old_result ?? "").trim().toUpperCase();
  const newResult = String(input.new_result ?? "").trim().toUpperCase();
  if (oldResult !== "FAIL") throw new Error("INVALID_FIX_VERIFICATION_TRANSITION");
  if (newResult !== "PASS") throw new Error("INVALID_FIX_VERIFICATION_TRANSITION");
  if (oldCommit === newCommit) throw new Error("INVALID_FIX_VERIFICATION_COMMITS");
  const reproducibilityKey = createHash("sha256")
    .update(JSON.stringify({ incidentId, regressionTest, oldCommit, oldResult, newCommit, newResult, minimalFix }))
    .digest("hex");
  return { incident_id: incidentId, correlation_id: correlationId, trace_id: traceId, regression_test: regressionTest, old_commit: oldCommit, old_result: oldResult, new_commit: newCommit, new_result: newResult, minimal_fix: minimalFix, calculation_version: "incident-fix-verification-v1", reproducibility_key: reproducibilityKey, ledger_untouched: true, read_only: true };
}
