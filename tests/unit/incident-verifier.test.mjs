import test from "node:test";
import assert from "node:assert/strict";
import { buildVerifierReview } from "../../apps/api/src/incident-verifier.ts";

test("TC-US-1705-A: independent verifier reports coverage pass/fail and missing tests", () => {
  const review = buildVerifierReview({
    incident_id: "incident-1705-a",
    correlation_id: "corr-1705-a",
    trace_id: "trace-1705-a",
    executed_tests: [
      { test_id: "TC-US-1704-ledger-untouched", result: "PASS" },
      { test_id: "TC-US-1703-ledger-untouched", result: "PASS" }
    ],
    missing_tests: ["TC-US-1705-ledger-untouched"],
    evidence_stale: false
  });
  assert.equal(review.coverage_verdict, "FAIL");
  assert.deepEqual(review.missing_tests, ["TC-US-1705-ledger-untouched"]);
  assert.equal(review.calculation_version, "incident-verifier-v1");
  assert.equal(review.read_only, true);
  assert.equal(review.ledger_untouched, true);
});

test("TC-US-1705-B: security findings carry severity/evidence/owner/blocking; blocking prevents promotion", () => {
  const review = buildVerifierReview({
    incident_id: "incident-1705-b",
    correlation_id: "corr-1705-b",
    trace_id: "trace-1705-b",
    executed_tests: [{ test_id: "TC-US-1704-x", result: "PASS" }],
    missing_tests: [],
    findings: [
      { severity: "CRITICAL", evidence: "ledger write outside command", owner: "security-owner", blocking: true }
    ]
  });
  assert.equal(review.security_verdict, "BLOCKED");
  assert.equal(review.promotion_allowed, false);
  const finding = review.findings[0];
  assert.equal(finding.severity, "CRITICAL");
  assert.equal(finding.blocking, true);
});

test("TC-US-1705-validation: rejects unknown severity or result", () => {
  assert.throws(() => buildVerifierReview({
    incident_id: "i", correlation_id: "c", trace_id: "t",
    executed_tests: [{ test_id: "x", result: "MAYBE" }],
    missing_tests: []
  }), /INVALID_VERIFIER_/);
  assert.throws(() => buildVerifierReview({
    incident_id: "i", correlation_id: "c", trace_id: "t",
    executed_tests: [],
    missing_tests: [],
    findings: [{ severity: "UNKNOWN", evidence: "e", owner: "o", blocking: false }]
  }), /INVALID_VERIFIER_/);
});
