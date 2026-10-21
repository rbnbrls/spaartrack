import { fixtureKey } from "../helpers/fixture-key.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const API = process.env.API_URL || "http://localhost:18080";
const STACK_SMOKE = process.env.STACK_SMOKE === "1";

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

test("TC-US-1604: proposal confirm/cancel with undo token is auditabel", async (t) => {
  if (!STACK_SMOKE) { t.skip("stack smoke only"); return; }
  const suffix = Date.now();
  const email = `synthetic-confirm-1604-${suffix}@example.test`;
  await api("/api/v1/users", { method: "POST", body: JSON.stringify({ email, display_name: "Synthetic Confirm" }) });
  const session = await api("/api/v1/test-fixtures/sessions", { method: "POST", headers: { "x-synthetic-fixture-key": fixtureKey() }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(session.status, 201);
  const auth = { Authorization: `Bearer ${session.body.token}` };
  const preview = await api("/api/v1/assistant-proposals", { method: "POST", headers: auth,
    body: JSON.stringify({ question: "Categoriseer synthetische transactie?", kind: "CATEGORIZATION",
      diff: [{ op: "SET", target: "ledger:txn-1", before: "U", after: "G" }], scope: ["PORTFOLIO_READ"], impact: "1", summary: "P" }) });
  assert.equal(preview.status, 201);
  assert.ok(preview.body.proposal_id);
  assert.ok(preview.body.undo_token);
  const pid = preview.body.proposal_id;
  const ut = preview.body.undo_token;
  const confirmed = await api(`/api/v1/assistant-proposals/${pid}/confirm`, { method: "POST", headers: auth, body: JSON.stringify({ undo_token: ut }) });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.status, "CONFIRMED");
  assert.equal(confirmed.body.calculation_version, "assistant-proposal-decision-v1");
  assert.equal(confirmed.body.audit_action, "ASSISTANT_PROPOSAL_DECISION");
  const cancelled = await api(`/api/v1/assistant-proposals/${pid}/cancel`, { method: "POST", headers: auth, body: JSON.stringify({ undo_token: ut }) });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.status, "CANCELLED");
  const bad = await api(`/api/v1/assistant-proposals/${pid}/confirm`, { method: "POST", headers: auth, body: JSON.stringify({ undo_token: "00000000-0000-4000-8000-000000000000" }) });
  assert.equal(bad.status, 400);
});
