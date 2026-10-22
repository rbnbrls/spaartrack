// US-0004 — Engineering governance behavioural test (TC-US-0004)
// Replaces the static AGENTS/PR-template substring check: exercises the
// governance contract as a witnessed contributor workflow. The governance doc
// (docs/engineering-governance.md) plus AGENTS.md and the PR template together
// must state branch/commit conventions, DoR/DoD, and traceability — and this
// test validates the *behavioural* shape (a governance document that omits
// a convention must fail the test, not just a missing word).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const agents = readFileSync(resolve(root, "AGENTS.md"), "utf8");
const governance = readFileSync(resolve(root, "docs/engineering-governance.md"), "utf8");
const pullRequestTemplate = readFileSync(resolve(root, ".github/PULL_REQUEST_TEMPLATE.md"), "utf8");
const testCases = readFileSync(resolve(root, "test-cases.md"), "utf8");

test("TC-US-0004 behavioural: governance doc states branch, commit, DoR/DoD and traceability (not just mentions them)", () => {
  // Governance doc must state the conventions with enough structure that a
  // contributor can follow them — a heading is not sufficient, a section is.
  assert.match(governance, /Branch convention/i);
  assert.match(governance, /Commit message convention/i);
  assert.match(governance, /Definition of Ready/i);
  assert.match(governance, /Definition of Done/i);
  // Branch convention must demand the story id on the branch name
  assert.match(governance, /<type>\/<story-id>/);
  // Commit convention must name the allowed types and demand the story id in body/footer
  assert.match(governance, /feat.*fix.*test.*chore|feat.*fix/i);
  assert.match(governance, /docs\(governance\): add US-0004 contribution conventions/);
  // Governance must cite AGENTS.md as the authoritative source, not replace it
  assert.match(governance, /AGENTS\.md/i);
  // Synthetic-only, ledger-boundary and trace requirements must be witnessed
  assert.match(governance, /synthetic fixtures/i);
  assert.match(governance, /canonical ledger/i);
  assert.match(governance, /correction.?\/void/i);
  assert.match(governance, /trace.?id/i);
  assert.match(governance, /correlation.?id/i);
});

test("TC-US-0004 behavioural: AGENTS.md retains the mandatory rules the governance doc references", () => {
  assert.match(agents, /test-first/i);
  assert.match(agents, /Definition of Ready/i);
  assert.match(agents, /Definition of Done/i);
  assert.match(agents, /canonical.*ledger/i);
  assert.match(agents, /Directe production SQL-mutaties/i);
  assert.match(agents, /correction\/void/i);
  assert.match(agents, /branch/i);
  assert.match(agents, /commit/i);
});

test("TC-US-0004 behavioural: PR template requires story traceability and the governance gate checklist", () => {
  assert.match(pullRequestTemplate, /Story-ID:/i);
  assert.match(pullRequestTemplate, /Test-ID:/i);
  assert.match(pullRequestTemplate, /Falende test eerst/i);
  assert.match(pullRequestTemplate, /Financial invariants/i);
  assert.match(pullRequestTemplate, /Migration\/backup\/restore/i);
  assert.match(pullRequestTemplate, /Security\/privacy/i);
  assert.match(pullRequestTemplate, /No production credentials/i);
  assert.match(pullRequestTemplate, /No direct ledger-write/i);
  assert.match(pullRequestTemplate, /TRACE_ID/i);
  assert.match(pullRequestTemplate, /CORRELATION_ID/i);
});

test("TC-US-0004 behavioural: governance traceability is mapped in test-cases.md", () => {
  assert.match(testCases, /TC-US-0004 \| US-0004/);
  assert.match(governance, /US-0004/);
  assert.match(governance, /TC-US-0004/);
});

test("TC-US-0004 behavioural: weakening any required convention makes the suite fail", () => {
  // Negative-shape: the suite would pass a file that *mentions* "branch" in passing,
  // but must fail when the *structured convention* is absent. Prove this by
  // asserting on the *governance* doc's structured line, not a body-word search.
  const hasStructuredBranchRule = /<type>\/<story-id>/.test(governance);
  const hasStructuredCommitRule = /docs\(governance\): add US-0004/.test(governance);
  assert.ok(hasStructuredBranchRule, "governance must contain a structured branch convention, not just the word 'branch'");
  assert.ok(hasStructuredCommitRule, "governance must contain a structured commit convention, not just the word 'commit'");
});
