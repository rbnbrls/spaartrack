import { createHash } from "node:crypto";

export interface SkillChange { file: string; action: "ADD" | "UPDATE" | "REMOVE"; summary: string; }

export interface SkillProposalInput {
  incident_id: string;
  correlation_id: string;
  trace_id: string;
  source_incident_id: string;
  title: string;
  runbook_markdown: string;
  skill_changes: SkillChange[];
  review_outcome: string;
  security_scan_outcome: string;
  test_outcome: string;
}

function requiredText(value: unknown, name: string, pattern: RegExp): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || !pattern.test(text)) throw new Error(`INVALID_PROPOSAL_${name.toUpperCase()}`);
  return text;
}

export function buildSkillProposal(input: SkillProposalInput) {
  const incidentId = requiredText(input.incident_id, "incident_id", /^[\w-]{1,120}$/);
  const correlationId = requiredText(input.correlation_id, "correlation_id", /^.{1,240}$/);
  const traceId = requiredText(input.trace_id, "trace_id", /^.{1,240}$/);
  const sourceId = requiredText(input.source_incident_id, "source_incident_id", /^[\w-]{1,120}$/);
  const title = requiredText(input.title, "title", /^.{3,200}$/);
  const runbook = requiredText(input.runbook_markdown, "runbook_markdown", /^# .{3,}[\s\S]{10,}$/);
  const changes = Array.isArray(input.skill_changes) ? input.skill_changes : null;
  if (!changes || changes.length === 0) throw new Error("INVALID_PROPOSAL_SKILL_CHANGES");
  for (const c of changes) {
    if (!c || typeof c.file !== "string" || !c.file.trim()) throw new Error("INVALID_PROPOSAL_SKILL_CHANGE_FILE");
    if (!["ADD", "UPDATE", "REMOVE"].includes(String(c.action))) throw new Error("INVALID_PROPOSAL_SKILL_CHANGE_ACTION");
    if (typeof c.summary !== "string" || !c.summary.trim()) throw new Error("INVALID_PROPOSAL_SKILL_CHANGE_SUMMARY");
  }
  const review = typeof input.review_outcome === "string" ? input.review_outcome.trim().toUpperCase() : "";
  const scan = typeof input.security_scan_outcome === "string" ? input.security_scan_outcome.trim().toUpperCase() : "";
  const testOut = typeof input.test_outcome === "string" ? input.test_outcome.trim().toUpperCase() : "";
  if (!["APPROVED", "REJECTED", "PENDING"].includes(review)) throw new Error("INVALID_PROPOSAL_REVIEW_OUTCOME");
  if (!["CLEAN", "FINDINGS", "PENDING"].includes(scan)) throw new Error("INVALID_PROPOSAL_SECURITY_SCAN_OUTCOME");
  if (!["PASS", "FAIL", "PENDING"].includes(testOut)) throw new Error("INVALID_PROPOSAL_TEST_OUTCOME");
  const blockers: string[] = [];
  if (review !== "APPROVED") blockers.push("review_outcome");
  if (scan !== "CLEAN") blockers.push("security_scan_outcome");
  if (testOut !== "PASS") blockers.push("test_outcome");
  const verdict = blockers.length === 0 ? "ACTIVE" : "BLOCKED";
  const reproducibilityKey = createHash("sha256")
    .update(JSON.stringify({ sourceId, title, runbook, changes, review, scan, testOut }))
    .digest("hex");
  return {
    incident_id: incidentId, correlation_id: correlationId, trace_id: traceId,
    source_incident_id: sourceId, title, runbook_markdown: runbook, skill_changes: changes,
    gates: { review, security_scan: scan, test: testOut },
    blockers, proposal_verdict: verdict, proposal_allowed: blockers.length === 0,
    reproducibility_key: reproducibilityKey,
    calculation_version: "incident-skill-proposal-v1",
    ledger_untouched: true as const, read_only: true as const
  };
}
