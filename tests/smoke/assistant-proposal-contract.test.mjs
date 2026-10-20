import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/assistant-proposal.ts", root), "utf8");
const web = readWebSource();

test("TC-US-1603: proposal preview without ledger mutation", () => {
  for (const marker of ["/api/v1/assistant-proposals", "assistantProposalRoute", "buildAssistantProposal", "assistant-proposal-v1", "PREVIEW", "undo_token", "trace_id", "correlation_id"]) {
    assert.match(api + kernel, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of ["assistant-proposal-panel", "assistant-proposal-form", "prepare-assistant-proposal", "assistant-proposal-submit", "assistant-proposal-result", "assistant-proposal-evidence", "assistant-proposal-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1603 runtime: preview proposal with undo token", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.API_URL || "http://localhost:18080").replace(/\/$/, "");
  const email = `synthetic-proposal-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Proposal" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const res = await fetch(`${base}/api/v1/assistant-proposals`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${session.token}`, "x-trace-id": "trace-proposal-1603", "x-correlation-id": "corr-proposal-1603" },
    body: JSON.stringify({
      question: "Categoriseer mijn supermarkt-import van januari",
      kind: "CATEGORIZATION",
      diff: [{ op: "set_category", target: "groceries", before: "uncategorized", after: "groceries" }],
      scope: ["PORTFOLIO_READ"],
      impact: "3 transactions previewed, 0 posted",
      summary: "Synthetic preview, awaiting confirm."
    })
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.status, "PREVIEW");
  assert.equal(body.calculation_version, "assistant-proposal-v1");
  assert.equal(body.read_only, true);
  assert.equal(body.mutation_tool_used, false);
  assert.match(res.headers.get("x-trace-id") || "", /trace-proposal-1603/);
});
