import test from "node:test";
import assert from "node:assert/strict";
import { buildAssistantAnswer } from "../../apps/api/src/assistant-answer.ts";

test("TC-US-1601-A: read-only portfolio answer cites period and uses no mutation tool", () => {
  const answer = buildAssistantAnswer({
    question: "What is my portfolio value?",
    domain: "PORTFOLIO",
    period_start: "2026-01-01",
    period_end: "2026-03-01",
    data_as_of: "2026-03-01T00:00:00.000Z",
    read_scopes: ["PORTFOLIO_READ"],
    summary: "Synthetic portfolio value EUR 100."
  });
  assert.equal(answer.domain, "PORTFOLIO");
  assert.equal(answer.period.start, "2026-01-01");
  assert.equal(answer.data_as_of, "2026-03-01T00:00:00.000Z");
  assert.equal(answer.mutation_tool_used, false);
  assert.equal(answer.calculation_version, "assistant-answer-v1");
  assert.equal(answer.read_only, true);
});

test("TC-US-1601-B: money flow answer respects account scope and category privacy", () => {
  const answer = buildAssistantAnswer({
    question: "How much did I spend?",
    domain: "MONEY_FLOW",
    period_start: "2026-01-01",
    period_end: "2026-03-01",
    data_as_of: "2026-03-01T00:00:00.000Z",
    read_scopes: ["MONEY_FLOW_READ"],
    account_scope: ["synthetic-account-1"],
    summary: "Synthetic spending EUR 42.50."
  });
  assert.equal(answer.domain, "MONEY_FLOW");
  assert.deepEqual(answer.account_scope, ["synthetic-account-1"]);
  assert.ok(answer.confidence >= 0 && answer.confidence <= 1);
  assert.throws(() => buildAssistantAnswer({
    question: "", domain: "PORTFOLIO", period_start: "2026-01-01",
    period_end: "2026-03-01", data_as_of: "2026-03-01T00:00:00.000Z",
    read_scopes: ["PORTFOLIO_READ"], summary: "x"
  }), /INVALID_ASSISTANT_ANSWER/);
  assert.throws(() => buildAssistantAnswer({
    question: "Move my money", domain: "PORTFOLIO", period_start: "2026-01-01",
    period_end: "2026-03-01", data_as_of: "2026-03-01T00:00:00.000Z",
    read_scopes: ["PORTFOLIO_READ"], summary: "x", mutation_tool_used: true
  }), /INVALID_ASSISTANT_ANSWER/);
});
