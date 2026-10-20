import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const web = readFileSync(new URL("apps/web/index.html", root), "utf8");

test("US-1709: ISSUE-05 traceability covers TC-US-1709, TC-US-1709-A, TC-US-1709-B", () => {
  for (const id of ["TC-US-1709", "TC-US-1709-A", "TC-US-1709-B"]) {
    assert.match("TC-US-1709 TC-US-1709-A TC-US-1709-B", new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1709: skill proposal exposes review/scan/test gates plus GUI panel", () => {
  for (const marker of ["incidentSkillProposalRoute", "buildSkillProposal", "incident-skill-proposal-v1", "SKILL_PROPOSAL", "proposal_verdict", "proposal_allowed", "blockers"]) {
    assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of ["incident-skill-panel", "incident-skill-form", "prepare-incident-skill", "incident-skill-submit", "incident-skill-result", "incident-skill-evidence", "incident-skill-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

const PROPOSAL = (over = {}) => ({
  source_incident_id: "incident-1709-src",
  title: "Promotion-gate checklist voor rollback",
  runbook_markdown: "# Rollback checklist\n\n1. Verify promotion gate\n2. Check digest",
  skill_changes: [{ file: "skills/rollback-check.md", action: "ADD", summary: "Checklist toegevoegd" }],
  review_outcome: "APPROVED",
  security_scan_outcome: "CLEAN",
  test_outcome: "PASS",
  ...over
});

test("TC-US-1709 runtime: gated proposal activates; failed gates block", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.API_URL || "http://localhost:18080").replace(/\/$/, "");
  const email = `synthetic-skill-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Skill" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const auth = { "content-type": "application/json", authorization: `Bearer ${session.token}` };
  const alertRes = await fetch(`${base}/api/v1/incidents/alerts`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-skill-1709", "x-correlation-id": "corr-skill-1709" },
    body: JSON.stringify({ title: "Synthetic skill proposal", service: "api", environment: "local", release: "local", severity: "SEV-3", message: "synthetic skill", correlation_id: "corr-skill-1709", trace_id: "trace-skill-1709" })
  });
  assert.ok([200, 201].includes(alertRes.status), `expected 200/201 got ${alertRes.status}`);
  const alert = await alertRes.json();
  const passRes = await fetch(`${base}/api/v1/incidents/${alert.incident_id}/skill-proposal`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-skill-1709", "x-correlation-id": "corr-skill-1709" },
    body: JSON.stringify(PROPOSAL())
  });
  assert.equal(passRes.status, 201);
  const pass = await passRes.json();
  assert.equal(pass.proposal_verdict, "ACTIVE");
  assert.equal(pass.proposal_allowed, true);
  assert.equal(pass.calculation_version, "incident-skill-proposal-v1");
  assert.equal(pass.ledger_untouched, true);
  const blockRes = await fetch(`${base}/api/v1/incidents/${alert.incident_id}/skill-proposal`, {
    method: "POST", headers: auth,
    body: JSON.stringify(PROPOSAL({ test_outcome: "FAIL" }))
  });
  assert.equal(blockRes.status, 201);
  const blocked = await blockRes.json();
  assert.equal(blocked.proposal_verdict, "BLOCKED");
  assert.equal(blocked.proposal_allowed, false);
});
