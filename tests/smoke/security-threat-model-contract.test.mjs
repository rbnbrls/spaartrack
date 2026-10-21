import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const modelPath = new URL("docs/security/us-0005-threat-model-v1.0.0.md", root);

test("TC-US-0005: versioned threat model covers required security boundaries and evidence scope", () => {
  const model = readFileSync(modelPath, "utf8");
  for (const section of [
    "## Scope, status and traceability",
    "## System context and data flows",
    "## Assets and security objectives",
    "## Trust boundaries",
    "## Threat actors",
    "## Abuse cases, mitigations and residual risks",
    "## Evidence status",
    "## Unresolved decisions and owner gates"
  ]) {
    assert.ok(model.includes(section), `missing required section: ${section}`);
  }
  for (const topic of [
    "authentication", "session", "TOTP", "OIDC", "tenant",
    "provider egress", "secret reference", "AI", "addon", "action",
    "artifact", "backup", "restore", "observability", "redaction",
    "export", "soft-delete", "TRACE_ID", "CORRELATION_ID"
  ]) {
    assert.match(model, new RegExp(topic, "i"), `missing threat-model topic: ${topic}`);
  }
  assert.match(model, /\bVERIFIED\b/);
  assert.match(model, /\bNOT VERIFIED\b/);
  assert.match(model, /TC-US-0005/);
  assert.match(model, /US-0005/);
  assert.match(model, /Poort C.*BLOCKED|BLOCKED.*Poort C/i);
});
