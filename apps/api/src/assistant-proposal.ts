import { randomUUID } from "crypto";

export type ProposalKind = "CATEGORIZATION" | "IMPORT_MAPPING";

export type ProposalDiffItem = {
  op: string;
  target: string;
  before: string;
  after: string;
};

export type AssistantProposal = {
  question: string;
  kind: ProposalKind;
  diff: ProposalDiffItem[];
  scope: string[];
  impact: string;
  summary: string;
  status: "PREVIEW";
  undo_token: string;
  mutation_tool_used: false;
  calculation_version: "assistant-proposal-v1";
  source: "ledger_transaction + import_mapping";
  read_only: true;
};

export type ProposalDecision = "CONFIRM" | "CANCEL";

export type AssistantProposalDecision = {
  status: "CONFIRMED" | "CANCELLED";
  undo_token: string;
  calculation_version: "assistant-proposal-decision-v1";
  source: "assistant_proposal_preview";
  read_only: true;
};

export function decideAssistantProposal(
  proposal: { undo_token?: string },
  input: { decision?: string; undo_token?: string }
): AssistantProposalDecision {
  const decision = String(input.decision ?? "").trim().toUpperCase();
  if (decision !== "CONFIRM" && decision !== "CANCEL") throw new Error("INVALID_PROPOSAL_DECISION");
  const expected = String(proposal.undo_token ?? "");
  const provided = String(input.undo_token ?? "");
  if (!expected || !provided || provided !== expected) throw new Error("INVALID_PROPOSAL_DECISION");
  if (!/^[0-9a-f-]{36}$/i.test(provided)) throw new Error("INVALID_PROPOSAL_DECISION");
  return {
    status: decision === "CONFIRM" ? "CONFIRMED" : "CANCELLED",
    undo_token: expected,
    calculation_version: "assistant-proposal-decision-v1",
    source: "assistant_proposal_preview",
    read_only: true
  };
}

export function buildAssistantProposal(input: {
  question?: string;
  kind?: string;
  diff?: ProposalDiffItem[];
  scope?: string[];
  impact?: string;
  summary?: string;
  mutation_tool_used?: boolean;
}): AssistantProposal {
  const question = String(input.question ?? "").trim();
  if (!question || question.length > 500) throw new Error("INVALID_ASSISTANT_PROPOSAL");
  const kind = String(input.kind ?? "").trim().toUpperCase();
  if (kind !== "CATEGORIZATION" && kind !== "IMPORT_MAPPING") throw new Error("INVALID_ASSISTANT_PROPOSAL");
  const diff = Array.isArray(input.diff) ? input.diff : [];
  if (diff.length === 0 || diff.length > 100) throw new Error("INVALID_ASSISTANT_PROPOSAL");
  for (const item of diff) {
    if (!item || typeof item.op !== "string" || !item.op.trim()) throw new Error("INVALID_ASSISTANT_PROPOSAL");
    if (typeof item.target !== "string" || !item.target.trim()) throw new Error("INVALID_ASSISTANT_PROPOSAL");
  }
  const scope = Array.isArray(input.scope) ? input.scope.map(String) : [];
  if (scope.length === 0 || scope.length > 10) throw new Error("INVALID_ASSISTANT_PROPOSAL");
  const impact = String(input.impact ?? "").trim();
  const summary = String(input.summary ?? "").trim();
  if (!impact || !summary || impact.length > 1000 || summary.length > 2000) throw new Error("INVALID_ASSISTANT_PROPOSAL");
  if (input.mutation_tool_used === true) throw new Error("INVALID_ASSISTANT_PROPOSAL");
  return {
    question,
    kind: kind as ProposalKind,
    diff,
    scope,
    impact,
    summary,
    status: "PREVIEW",
    undo_token: randomUUID(),
    mutation_tool_used: false,
    calculation_version: "assistant-proposal-v1",
    source: "ledger_transaction + import_mapping",
    read_only: true
  };
}
