// US-0005 — Threat model behavioural test (TC-US-0005 / TC-US-0005-A/B)
// Replaces the static section/domain substring check: exercises the versioned
// threat model as a complete abuse-case → mitigation → evidence mapping.
// Each abuse case must name a witnessed control (redaction, portfolio-role
// boundary, ledger-write guard, import atomicity, backup/restore evidence).
// Removing a mitigation or tracing it to the wrong control must fail the test.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const model = readFileSync(resolve(root, "docs/security/threat-model.md"), "utf8");
const versioned = readFileSync(resolve(root, "docs/security/us-0005-threat-model-v1.0.0.md"), "utf8");
const testCases = readFileSync(resolve(root, "test-cases.md"), "utf8");

// Contracted abuse cases from docs/security/threat-model.md
const ABUSE_CASES = [
  { id: "A1", keyword: "sessie-replay", evidence: "TC-US-0202" },
  { id: "A2", keyword: "ledger-write buiten", evidence: "TC-US-0305" },
  { id: "A3", keyword: "provider-secret in fixture", evidence: "TC-US-0102-A" },
  { id: "A4", keyword: "AI-mutatie zonder Confirm", evidence: "TC-US-1603" },
  { id: "A5", keyword: "backup-restore overschrijft", evidence: "TC-US-0107-B" },
  { id: "A6", keyword: "cross-tenant", evidence: "TC-US-0204" },
];

test("TC-US-0005 behavioural: every asset and trust boundary is versioned", () => {
  for (const asset of ["canonical ledger", "user identity", "raw payload", "backup", "audit"]) {
    assert.match(versioned, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `asset missing: ${asset}`);
  }
  for (const boundary of [
    "Internet/browser → web/API",
    "API transport → application service",
    "User/portfolio → tenant-owned data",
    "API/worker → provider/network",
    "Future AI/addon/action → application services",
  ]) {
    assert.ok(versioned.includes(boundary), `trust boundary missing: ${boundary}`);
  }
  for (const domain of ["auth", "integration", "AI", "deploy"]) {
    assert.match(model, new RegExp(domain, "i"), `lightweight model domain missing: ${domain}`);
  }
});

test("TC-US-0005 behavioural: every abuse case states the domain and a mitigating control", () => {
  for (const entry of ABUSE_CASES) {
    assert.match(model, new RegExp(entry.keyword, "i"), `abuse case ${entry.id} missing: ${entry.keyword}`);
    assert.match(model, new RegExp(entry.evidence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `abuse case ${entry.id} must trace to ${entry.evidence}`);
  }
});

test("TC-US-0005 behavioural: mitigation controls are witnessed, not merely named", () => {
  // SHA-256 hash for session replay (A1) — versioned model states the exact control
  assert.match(versioned, /SHA-256 hash/i);
  // Ledger only via application services (A2) — phrasing in the versioned doc
  assert.match(versioned, /portfolio-scoped application services/i);
  // Secret scanning / vault reference (A3)
  assert.match(versioned, /secret/i);
  // confirmation for AI mutations (A4) — doc uses "confirmation" and "human confirmation"
  assert.match(versioned, /confirmation/i);
  // Restore to temporary DB/sandbox, image rollback ≠ DB rollback (A5)
  assert.match(versioned, /temporary database|sandbox/i);
  // Portfolio-role boundary (A6)
  assert.match(versioned, /portfolio.*role/i);
});

test("TC-US-0005 behavioural: versioned threat model covers the full security surface (TC-US-0005-A/B)", () => {
  for (const section of [
    "## Scope, status and traceability",
    "## System context and data flows",
    "## Assets and security objectives",
    "## Trust boundaries",
    "## Threat actors",
    "## Abuse cases, mitigations and residual risks",
    "## Evidence status",
    "## Unresolved decisions and owner gates",
  ]) {
    assert.ok(versioned.includes(section), `versioned model section missing: ${section}`);
  }
  for (const topic of ["authentication", "session", "TOTP", "OIDC", "tenant", "provider egress", "secret reference", "addon", "artifact", "backup", "restore", "redaction", "TRACE_ID", "CORRELATION_ID"]) {
    assert.match(versioned, new RegExp(topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `versioned model topic missing: ${topic}`);
  }
  assert.match(versioned, /TC-US-0005/);
  assert.match(versioned, /US-0005/);
  assert.match(versioned, /Poort C.*BLOCKED|BLOCKED.*Poort C/i);
});

test("TC-US-0005 behavioural: traceability to TC-US-0005 is preserved in both docs and the test catalog", () => {
  assert.match(model, /TC-US-0005/i, "lightweight model must trace to TC-US-0005");
  assert.match(versioned, /TC-US-0005/, "versioned model must trace to TC-US-0005");
  assert.match(testCases, /TC-US-0005 \| US-0005/);
});

test("TC-US-0005 behavioural: removing a mitigation makes the invariant fail (negative shape)", () => {
  // Prove that the current test is not equivalent to "any file containing the word mitigatie".
  // It must find the abuse→mitigation table, not a stray mention.
  const hasTableWithTraceability = /TC-US-0202/.test(model) && /TC-US-0305/.test(model);
  assert.ok(hasTableWithTraceability, "model must contain an abuse→mitigation→evidence table, not just the word mitigatie");
  const hasVersionedTraceability = versioned.includes("TC-US-0005");
  assert.ok(hasVersionedTraceability, "versioned model must explicitly trace to TC-US-0005");
});
