import test from "node:test";
import assert from "node:assert/strict";
import { buildAssistantProposal } from "../../apps/api/src/assistant-proposal.ts";

test("TC-US-1603: proposal preview is read-only without ledger mutation", () => {
  const proposal = buildAssistantProposal({
    question: "Categoriseer mijn supermarkt-import van januari",
    kind: "CATEGORIZATION",
    diff: [{ op: "set_category", target: "groceries", before: "uncategorized", after: "groceries" }],
    scope: ["PORTFOLIO_READ"],
    impact: "3 transactions previewed, 0 posted",
    summary: "Preview only, awaiting confirm"
  });
  assert.equal(proposal.calculation_version, "assistant-proposal-v1");
  assert.equal(proposal.read_only, true);
  assert.equal(proposal.status, "PREVIEW");
  assert.equal(proposal.mutation_tool_used, false);
  assert.match(proposal.undo_token, /^[0-9a-f-]{36}$/);
});

test("TC-US-1603: mutation request without confirm is rejected", () => {
  assert.throws(() => buildAssistantProposal({
    question: "x", kind: "CATEGORIZATION", diff: [],
    scope: ["PORTFOLIO_READ"], impact: "i", summary: "s", mutation_tool_used: true
  }), /INVALID_ASSISTANT_PROPOSAL/);
});
