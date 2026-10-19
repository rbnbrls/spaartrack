import test from "node:test";
import assert from "node:assert/strict";
import { buildIncidentClosure } from "../../apps/api/src/incident-closure.ts";

const FULL = {
  root_cause: "Synthetic migration 0026 raced the promotion gate on staging",
  impact: "SEV-3 synthetic staging only, no ledger mutation, 2 synthetic deploys delayed",
  timeline: [
    { at: "2026-10-19T14:00:00.000Z", event: "alert routed to incident" },
    { at: "2026-10-19T14:20:00.000Z", event: "fix verified on staging digest" }
  ],
  fix_summary: "Pinned rollback to policy-approved digest and re-ran verifier review",
  regression_test_id: "TC-US-1707",
  release_ref: "sha256:" + "a".repeat(64),
  prevention_item: "Add promotion-gate check to pre-rollback checklist"
};

test("TC-US-1708-A: complete evidence closes incident", () => {
  const closure = buildIncidentClosure({
    incident_id: "incident-1708-a", correlation_id: "corr-1708-a", trace_id: "trace-1708-a",
    ...FULL
  });
  assert.equal(closure.closure_verdict, "CLOSED");
  assert.equal(closure.closure_allowed, true);
  assert.deepEqual(closure.missing_fields, []);
  assert.equal(closure.calculation_version, "incident-closure-v1");
  assert.equal(closure.ledger_untouched, true);
  assert.equal(closure.read_only, true);
});

test("TC-US-1708-A-incomplete: missing fields block closure", () => {
  const closure = buildIncidentClosure({
    incident_id: "incident-1708-m", correlation_id: "c", trace_id: "t",
    ...FULL, prevention_item: "  ", regression_test_id: ""
  });
  assert.equal(closure.closure_verdict, "BLOCKED");
  assert.equal(closure.closure_allowed, false);
  assert.ok(closure.missing_fields.includes("prevention_item"));
  assert.ok(closure.missing_fields.includes("regression_test_id"));
});

test("TC-US-1708-B: closure requires all seven evidence sections", () => {
  const closure = buildIncidentClosure({
    incident_id: "incident-1708-b", correlation_id: "c", trace_id: "t", ...FULL
  });
  for (const s of ["root_cause", "impact", "timeline", "fix", "test", "release", "prevention"]) {
    assert.ok(closure.sections_present.includes(s), `missing section ${s}`);
  }
});

test("TC-US-1708-validation: rejects bad timeline/release", () => {
  assert.throws(() => buildIncidentClosure({
    incident_id: "i", correlation_id: "c", trace_id: "t", ...FULL, timeline: []
  }), /INVALID_CLOSURE_/);
  assert.throws(() => buildIncidentClosure({
    incident_id: "i", correlation_id: "c", trace_id: "t", ...FULL, release_ref: "!!! not a digest !!!"
  }), /INVALID_CLOSURE_/);
});
