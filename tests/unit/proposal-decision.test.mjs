import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decideAssistantProposal } from "../../apps/api/src/assistant-proposal.ts";

const base = {
  question: "Categoriseer synthetische transactie?",
  kind: "CATEGORIZATION",
  diff: [{ op: "SET", target: "ledger:txn-1", before: "UNCATEGORIZED", after: "GROCERIES" }],
  scope: ["PORTFOLIO_READ"],
  impact: "1 transactie",
  summary: "Preview",
};

describe("US-1604 proposal decision", () => {
  it("confirms with matching undo token", () => {
    const created = { ...base, undo_token: "11111111-1111-4111-8111-111111111111" };
    const decided = decideAssistantProposal(created, { decision: "CONFIRM", undo_token: created.undo_token });
    assert.equal(decided.status, "CONFIRMED");
    assert.equal(decided.undo_token, created.undo_token);
    assert.equal(decided.calculation_version, "assistant-proposal-decision-v1");
    assert.equal(decided.read_only, true);
  });
  it("rejects mismatched undo token and bad decision", () => {
    const created = { ...base, undo_token: "22222222-2222-4222-8222-222222222222" };
    assert.throws(() => decideAssistantProposal(created, { decision: "CONFIRM", undo_token: "mismatch" }), /INVALID_PROPOSAL_DECISION/);
    assert.throws(() => decideAssistantProposal(created, { decision: "APPLY", undo_token: created.undo_token }), /INVALID_PROPOSAL_DECISION/);
  });
});
