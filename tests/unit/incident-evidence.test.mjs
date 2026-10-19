import test from "node:test";
import assert from "node:assert/strict";
import { buildIncidentEvidenceBundle, redactEvidenceValue } from "../../apps/api/src/incident-evidence.ts";

test("TC-US-1702-A: evidence bundle redacts PII while retaining correlation and trace exemplars", () => {
  const bundle = buildIncidentEvidenceBundle({
    incident_id: "incident-1702-a",
    correlation_id: "corr-1702-a",
    trace_id: "trace-1702-a",
    logs: [{
      timestamp: "2026-10-18T10:00:00.000Z",
      level: "error",
      service: "api",
      message: "request failed for user@example.test",
      fields: { authorization: "Bearer synthetic-secret", account_number: "NL00TEST1234" }
    }],
    traces: [{ trace_id: "trace-1702-a", span_id: "span-1", operation: "incident.route", attributes: { email: "user@example.test" } }],
    metrics: [{ name: "api_errors_total", value: 3, labels: { portfolio_id: "private-portfolio" } }],
    release: { release: "local-1702", commit_sha: "a".repeat(40), image_digest: "sha256:" + "b".repeat(64), migration_result: "SUCCEEDED" },
    runbooks: ["docs/runbooks/incident-response.md"]
  });

  assert.equal(bundle.calculation_version, "incident-evidence-v1");
  assert.equal(bundle.read_only, true);
  assert.equal(bundle.pii_redacted, true);
  assert.equal(bundle.correlation_id, "corr-1702-a");
  assert.equal(bundle.trace_id, "trace-1702-a");
  assert.match(bundle.logs[0].message, /\[REDACTED_EMAIL\]/);
  assert.equal(bundle.logs[0].fields.authorization, "[REDACTED_SECRET]");
  assert.equal(bundle.logs[0].fields.account_number, "[REDACTED_ACCOUNT]");
  assert.equal(bundle.traces[0].trace_id, "trace-1702-a");
  assert.equal(bundle.metrics[0].value, 3);
});

test("TC-US-1702-B: release and migration context is linked and validated", () => {
  const bundle = buildIncidentEvidenceBundle({
    incident_id: "incident-1702-b",
    correlation_id: "corr-1702-b",
    trace_id: "trace-1702-b",
    release: { release: "release-1702", commit_sha: "c".repeat(40), image_digest: "sha256:" + "d".repeat(64), migration_result: "SUCCEEDED" },
    deploys: [{ environment: "local", status: "HEALTHY", observed_at: "2026-10-18T10:05:00.000Z" }],
    migrations: [{ version: "0024", status: "APPLIED", reversible: true }],
    runbooks: ["docs/runbooks/incident-response.md"]
  });

  assert.equal(bundle.release.release, "release-1702");
  assert.equal(bundle.release.commit_sha, "c".repeat(40));
  assert.equal(bundle.release.image_digest, "sha256:" + "d".repeat(64));
  assert.equal(bundle.release.migration_result, "SUCCEEDED");
  assert.equal(bundle.deploys[0].status, "HEALTHY");
  assert.equal(bundle.migrations[0].version, "0024");
  assert.deepEqual(bundle.runbooks, ["docs/runbooks/incident-response.md"]);
});

test("TC-US-1702-redaction: nested secret values never survive redaction", () => {
  assert.deepEqual(redactEvidenceValue({ token: "secret", nested: { password: "pw", safe: "ok" } }), {
    token: "[REDACTED_SECRET]",
    nested: { password: "[REDACTED_SECRET]", safe: "ok" }
  });
});
