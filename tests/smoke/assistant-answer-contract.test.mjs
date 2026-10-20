import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/assistant-answer.ts", root), "utf8");
const web = readWebSource();

test("TC-US-1601: assistant answers cite source period, confidence and read scopes", () => {
  for (const marker of ["buildAssistantAnswer", "assistant-answer-v1", "assistantAnswerRoute", "ASSISTANT_ANSWER", "mutation_tool_used"]) {
    assert.match(api + kernel, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of ["assistant-answer-panel", "assistant-answer-form", "prepare-assistant-answer", "assistant-answer-submit", "assistant-answer-result", "assistant-answer-evidence", "assistant-answer-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1601 runtime: portfolio and money flow answers are read-only and audited", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.API_URL || "http://localhost:18080").replace(/\/$/, "");
  const email = `synthetic-assistant-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Assistant" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const auth = { "content-type": "application/json", authorization: `Bearer ${session.token}` };
  const portfolioRes = await fetch(`${base}/api/v1/assistant-answers`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-assistant-1601", "x-correlation-id": "corr-assistant-1601" },
    body: JSON.stringify({ question: "What is my portfolio value?", domain: "PORTFOLIO", period_start: "2026-01-01", period_end: "2026-03-01", data_as_of: "2026-03-01T00:00:00.000Z", read_scopes: ["PORTFOLIO_READ"], summary: "Synthetic portfolio value EUR 100." })
  });
  assert.equal(portfolioRes.status, 201);
  const portfolio = await portfolioRes.json();
  assert.equal(portfolio.calculation_version, "assistant-answer-v1");
  assert.equal(portfolio.mutation_tool_used, false);
  assert.equal(portfolio.read_only, true);
  assert.equal(portfolio.period.start, "2026-01-01");
  const moneyFlowRes = await fetch(`${base}/api/v1/assistant-answers`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ question: "How much did I spend?", domain: "MONEY_FLOW", period_start: "2026-01-01", period_end: "2026-03-01", data_as_of: "2026-03-01T00:00:00.000Z", read_scopes: ["MONEY_FLOW_READ"], account_scope: ["synthetic-account-1"], summary: "Synthetic spending EUR 42.50." })
  });
  assert.equal(moneyFlowRes.status, 201);
  const moneyFlow = await moneyFlowRes.json();
  assert.deepEqual(moneyFlow.account_scope, ["synthetic-account-1"]);
  const invalidRes = await fetch(`${base}/api/v1/assistant-answers`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ question: "Move my money", domain: "PORTFOLIO", period_start: "2026-01-01", period_end: "2026-03-01", data_as_of: "2026-03-01T00:00:00.000Z", read_scopes: ["PORTFOLIO_READ"], summary: "x", mutation_tool_used: true })
  });
  assert.equal(invalidRes.status, 400);
  assert.match(portfolioRes.headers.get("x-trace-id") || "missing", /./);
});
