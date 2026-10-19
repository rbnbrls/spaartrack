import { createHash } from "node:crypto";

export interface IncidentHypothesisInput {
  incident_id: string;
  correlation_id: string;
  trace_id: string;
  confidence: number;
  affected_path: string;
  invariant: string;
  proposed_regression_test: string;
  rationale?: string;
}

function requiredText(value: unknown, name: string, max = 240): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > max) throw new Error(`INVALID_INCIDENT_HYPOTHESIS_${name.toUpperCase()}`);
  return text;
}

export function buildIncidentHypothesis(input: IncidentHypothesisInput): IncidentHypothesisInput & {
  calculation_version: "incident-diagnosis-v1";
  reproducibility_key: string;
  read_only: true;
} {
  const confidence = Number(input.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error("INVALID_INCIDENT_HYPOTHESIS_CONFIDENCE");
  const incidentId = requiredText(input.incident_id, "incident_id");
  const correlationId = requiredText(input.correlation_id, "correlation_id");
  const traceId = requiredText(input.trace_id, "trace_id");
  const affectedPath = requiredText(input.affected_path, "affected_path");
  const invariant = requiredText(input.invariant, "invariant");
  const proposedRegressionTest = requiredText(input.proposed_regression_test, "proposed_regression_test");
  const rationale = input.rationale === undefined ? "" : requiredText(input.rationale, "rationale", 500);
  const reproducibilityKey = createHash("sha256")
    .update(JSON.stringify({ incidentId, correlationId, traceId, confidence, affectedPath, invariant, proposedRegressionTest, rationale }))
    .digest("hex");
  return { incident_id: incidentId, correlation_id: correlationId, trace_id: traceId, confidence, affected_path: affectedPath, invariant, proposed_regression_test: proposedRegressionTest, rationale, calculation_version: "incident-diagnosis-v1", reproducibility_key: reproducibilityKey, read_only: true };
}
