import test from "node:test";
import assert from "node:assert/strict";
import { buildFixVerification } from "../../apps/api/src/incident-fix-verification.ts";

test("TC-US-1704: failing test on old commit passes after minimal fix", () => {
  const verification = buildFixVerification({
    incident_id: "incident-1704-a",
    correlation_id: "corr-1704-a",
    trace_id: "trace-1704-a",
    regression_test: "TC-US-1704-ledger-untouched",
    old_commit: "abc123old",
    old_result: "FAIL",
    new_commit: "def456new",
    new_result: "PASS",
    minimal_fix: "Guard ledger write with read-only check in fix path."
  });
  assert.equal(verification.old_result, "FAIL");
  assert.equal(verification.new_result, "PASS");
  assert.equal(verification.calculation_version, "incident-fix-verification-v1");
  assert.equal(verification.read_only, true);
  assert.equal(verification.ledger_untouched, true);
  assert.equal(verification.reproducibility_key.length, 64);
});

test("TC-US-1704-validation: rejects non-failing old result or non-passing new result", () => {
  assert.throws(() => buildFixVerification({
    incident_id: "incident-1704-b",
    correlation_id: "corr-1704-b",
    trace_id: "trace-1704-b",
    regression_test: "TC-US-1704-x",
    old_commit: "abc",
    old_result: "PASS",
    new_commit: "def",
    new_result: "PASS",
    minimal_fix: "fix"
  }), /INVALID_FIX_VERIFICATION_TRANSITION/);
  assert.throws(() => buildFixVerification({
    incident_id: "incident-1704-c",
    correlation_id: "corr-1704-c",
    trace_id: "trace-1704-c",
    regression_test: "TC-US-1704-x",
    old_commit: "same",
    old_result: "FAIL",
    new_commit: "same",
    new_result: "PASS",
    minimal_fix: "fix"
  }), /INVALID_FIX_VERIFICATION_COMMITS/);
});
