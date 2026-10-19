import { createHash } from "node:crypto";

export interface ClosureTimelineEntry { at: string; event: string; }

export interface IncidentClosureInput {
  incident_id: string;
  correlation_id: string;
  trace_id: string;
  root_cause: string;
  impact: string;
  timeline: ClosureTimelineEntry[];
  fix_summary: string;
  regression_test_id: string;
  release_ref: string;
  prevention_item: string;
}

function requiredText(value: unknown, name: string, pattern: RegExp): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || !pattern.test(text)) throw new Error(`INVALID_CLOSURE_${name.toUpperCase()}`);
  return text;
}

export function buildIncidentClosure(input: IncidentClosureInput) {
  const incidentId = requiredText(input.incident_id, "incident_id", /^[\w-]{1,120}$/);
  const correlationId = requiredText(input.correlation_id, "correlation_id", /^.{1,240}$/);
  const traceId = requiredText(input.trace_id, "trace_id", /^.{1,240}$/);
  const rootCause = typeof input.root_cause === "string" ? input.root_cause.trim() : "";
  const impact = typeof input.impact === "string" ? input.impact.trim() : "";
  const fixSummary = typeof input.fix_summary === "string" ? input.fix_summary.trim() : "";
  const regressionTest = typeof input.regression_test_id === "string" ? input.regression_test_id.trim() : "";
  const releaseRef = typeof input.release_ref === "string" ? input.release_ref.trim() : "";
  const prevention = typeof input.prevention_item === "string" ? input.prevention_item.trim() : "";
  const timeline = Array.isArray(input.timeline) ? input.timeline : null;
  if (!timeline || timeline.length < 2) throw new Error("INVALID_CLOSURE_TIMELINE");
  for (const e of timeline) {
    if (!e || isNaN(Date.parse(String(e.at))) || !String(e.event || "").trim()) throw new Error("INVALID_CLOSURE_TIMELINE");
  }
  if (releaseRef && !/^(sha256:[0-9a-f]{64}|[\w.-]{1,120})$/i.test(releaseRef)) throw new Error("INVALID_CLOSURE_RELEASE_REF");
  const missing: string[] = [];
  if (!rootCause) missing.push("root_cause");
  if (!impact) missing.push("impact");
  if (!fixSummary) missing.push("fix_summary");
  if (!regressionTest) missing.push("regression_test_id");
  if (!releaseRef) missing.push("release_ref");
  if (!prevention) missing.push("prevention_item");
  const sections = ["root_cause", "impact", "timeline", "fix", "test", "release", "prevention"];
  const verdict = missing.length === 0 ? "CLOSED" : "BLOCKED";
  const reproducibilityKey = createHash("sha256")
    .update(JSON.stringify({ rootCause, impact, timeline, fixSummary, regressionTest, releaseRef, prevention }))
    .digest("hex");
  return {
    incident_id: incidentId, correlation_id: correlationId, trace_id: traceId,
    root_cause: rootCause, impact, timeline, fix_summary: fixSummary,
    regression_test_id: regressionTest, release_ref: releaseRef, prevention_item: prevention,
    sections_present: sections, missing_fields: missing,
    closure_verdict: verdict, closure_allowed: missing.length === 0,
    reproducibility_key: reproducibilityKey,
    calculation_version: "incident-closure-v1",
    ledger_untouched: true as const, read_only: true as const
  };
}
