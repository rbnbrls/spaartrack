import test from "node:test";
import assert from "node:assert/strict";
import { buildSkillProposal } from "../../apps/api/src/incident-skill-proposal.ts";

const FULL = {
  source_incident_id: "incident-1708-a",
  title: "Promotion-gate checklist voor rollback",
  runbook_markdown: "# Rollback checklist\n\n1. Verify promotion gate\n2. Check policy-approved digest\n3. Separate data restore",
  skill_changes: [{ file: "skills/rollback-check.md", action: "ADD", summary: "Checklist toegevoegd" }],
  review_outcome: "APPROVED",
  security_scan_outcome: "CLEAN",
  test_outcome: "PASS"
};

test("TC-US-1709-A: reviewed skill change activates proposal", () => {
  const p = buildSkillProposal({
    incident_id: "incident-1709-a", correlation_id: "corr-1709-a", trace_id: "trace-1709-a",
    ...FULL
  });
  assert.equal(p.proposal_verdict, "ACTIVE");
  assert.equal(p.proposal_allowed, true);
  assert.deepEqual(p.blockers, []);
  assert.equal(p.calculation_version, "incident-skill-proposal-v1");
  assert.equal(p.ledger_untouched, true);
  assert.equal(p.read_only, true);
});

test("TC-US-1709-A-blocked: failed scan or test blocks activation", () => {
  const p = buildSkillProposal({
    incident_id: "incident-1709-m", correlation_id: "c", trace_id: "t",
    ...FULL, security_scan_outcome: "FINDINGS", test_outcome: "FAIL"
  });
  assert.equal(p.proposal_verdict, "BLOCKED");
  assert.equal(p.proposal_allowed, false);
  assert.ok(p.blockers.includes("security_scan_outcome"));
  assert.ok(p.blockers.includes("test_outcome"));
});

test("TC-US-1709-B: proposal tracks review/scan/test gates separately", () => {
  const p = buildSkillProposal({
    incident_id: "incident-1709-b", correlation_id: "c", trace_id: "t", ...FULL
  });
  assert.deepEqual(p.gates, { review: "APPROVED", security_scan: "CLEAN", test: "PASS" });
});

test("TC-US-1709-validation: rejects bad title/runbook/changes", () => {
  assert.throws(() => buildSkillProposal({
    incident_id: "i", correlation_id: "c", trace_id: "t", ...FULL, title: "  "
  }), /INVALID_PROPOSAL_/);
  assert.throws(() => buildSkillProposal({
    incident_id: "i", correlation_id: "c", trace_id: "t", ...FULL, skill_changes: []
  }), /INVALID_PROPOSAL_/);
});
