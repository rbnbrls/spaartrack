import test from "node:test";
import assert from "node:assert/strict";
import { buildIncidentHypothesis } from "../../apps/api/src/incident-diagnosis.ts";

test("TC-US-1703: builds a deterministic incident hypothesis", () => {
  const hypothesis = buildIncidentHypothesis({
    incident_id: "incident-1703-a",
    correlation_id: "corr-1703-a",
    trace_id: "trace-1703-a",
    confidence: 0.87,
    affected_path: "POST /api/v1/incidents/:id/evidence",
    invariant: "PII redaction must preserve trace and correlation exemplars",
    proposed_regression_test: "TC-US-1703-redaction-preserves-trace",
    rationale: "The redacted evidence bundle retained operational identifiers while removing secret values."
  });

  assert.equal(hypothesis.calculation_version, "incident-diagnosis-v1");
  assert.equal(hypothesis.confidence, 0.87);
  assert.equal(hypothesis.affected_path, "POST /api/v1/incidents/:id/evidence");
  assert.match(hypothesis.invariant, /PII redaction/);
  assert.equal(hypothesis.proposed_regression_test, "TC-US-1703-redaction-preserves-trace");
  assert.equal(hypothesis.read_only, true);
  assert.equal(hypothesis.reproducibility_key.length, 64);
});

test("TC-US-1703-validation: rejects confidence outside 0..1", () => {
  assert.throws(() => buildIncidentHypothesis({
    incident_id: "incident-1703-b",
    correlation_id: "corr-1703-b",
    trace_id: "trace-1703-b",
    confidence: 1.1,
    affected_path: "api",
    invariant: "invariant",
    proposed_regression_test: "TC-US-1703-invalid"
  }), /INVALID_INCIDENT_HYPOTHESIS_CONFIDENCE/);
});
