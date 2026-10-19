import { createHash } from "node:crypto";

export interface VerifierTestResult {
  test_id: string;
  result: "PASS" | "FAIL";
}

export interface VerifierFinding {
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  evidence: string;
  owner: string;
  blocking: boolean;
}

export interface VerifierReviewInput {
  incident_id: string;
  correlation_id: string;
  trace_id: string;
  executed_tests: VerifierTestResult[];
  missing_tests: string[];
  findings?: VerifierFinding[];
  evidence_stale?: boolean;
}

const RESULTS = ["PASS", "FAIL"] as const;
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

function requiredText(value: unknown, name: string, max = 240): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > max) throw new Error(`INVALID_VERIFIER_${name.toUpperCase()}`);
  return text;
}

export function buildVerifierReview(input: VerifierReviewInput): VerifierReviewInput & {
  calculation_version: "incident-verifier-v1";
  reproducibility_key: string;
  coverage_verdict: "PASS" | "FAIL";
  security_verdict: "CLEAR" | "BLOCKED";
  promotion_allowed: boolean;
  ledger_untouched: true;
  read_only: true;
} {
  const incidentId = requiredText(input.incident_id, "incident_id");
  const correlationId = requiredText(input.correlation_id, "correlation_id");
  const traceId = requiredText(input.trace_id, "trace_id");
  const executed = Array.isArray(input.executed_tests) ? input.executed_tests : null;
  if (!executed) throw new Error("INVALID_VERIFIER_EXECUTED_TESTS");
  for (const t of executed) {
    requiredText(t.test_id, "test_id", 120);
    if (!RESULTS.includes(t.result as never)) throw new Error("INVALID_VERIFIER_TEST_RESULT");
  }
  const missing = Array.isArray(input.missing_tests) ? input.missing_tests : null;
  if (!missing) throw new Error("INVALID_VERIFIER_MISSING_TESTS");
  for (const m of missing) requiredText(m, "missing_test", 120);
  const findings = Array.isArray(input.findings) ? input.findings : [];
  for (const f of findings) {
    if (!SEVERITIES.includes(f.severity as never)) throw new Error("INVALID_VERIFIER_SEVERITY");
    requiredText(f.evidence, "finding_evidence", 500);
    requiredText(f.owner, "finding_owner", 120);
    if (typeof f.blocking !== "boolean") throw new Error("INVALID_VERIFIER_BLOCKING");
  }
  const coverageVerdict = missing.length === 0 && executed.every((t) => t.result === "PASS") ? "PASS" : "FAIL";
  const securityVerdict = findings.some((f) => f.blocking) ? "BLOCKED" : "CLEAR";
  const promotionAllowed = coverageVerdict === "PASS" && securityVerdict === "CLEAR";
  const reproducibilityKey = createHash("sha256")
    .update(JSON.stringify({ incidentId, executed, missing, findings }))
    .digest("hex");
  return {
    incident_id: incidentId, correlation_id: correlationId, trace_id: traceId,
    executed_tests: executed, missing_tests: missing, findings,
    evidence_stale: Boolean(input.evidence_stale),
    calculation_version: "incident-verifier-v1", reproducibility_key: reproducibilityKey,
    coverage_verdict: coverageVerdict, security_verdict: securityVerdict,
    promotion_allowed: promotionAllowed, ledger_untouched: true, read_only: true
  };
}
