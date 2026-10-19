import test from "node:test";
import assert from "node:assert/strict";
import { buildIncidentAlert, incidentFingerprint, mergeIncidentStatus } from "../../apps/api/src/incident-routing.ts";

test("TC-US-1701-A: same cause within the grouping window has a stable fingerprint", () => {
  const first = buildIncidentAlert({
    title: "Synthetic API timeout",
    service: "api",
    environment: "local",
    release: "local",
    severity: "SEV-2",
    message: "request timeout",
    occurred_at: "2026-10-18T10:00:00.000Z",
    correlation_id: "corr-1701-a",
    trace_id: "trace-1701-a"
  });
  const repeat = buildIncidentAlert({
    title: "Synthetic API timeout",
    service: "api",
    environment: "local",
    release: "local",
    severity: "SEV-1",
    message: "request timeout",
    occurred_at: "2026-10-18T10:05:00.000Z",
    correlation_id: "corr-1701-b",
    trace_id: "trace-1701-b"
  });
  assert.equal(first.fingerprint, repeat.fingerprint);
  assert.equal(first.grouping_window_minutes, 15);
  assert.equal(first.read_only, true);
  assert.notEqual(first.correlation_id, repeat.correlation_id);
});

test("TC-US-1701-B: incident status contains operational routing fields", () => {
  const alert = buildIncidentAlert({
    title: "Synthetic worker failure",
    service: "worker",
    environment: "local",
    release: "release-1701",
    severity: "SEV-3",
    message: "synthetic failure",
    correlation_id: "corr-1701",
    trace_id: "trace-1701"
  });
  const status = mergeIncidentStatus({
    fingerprint: incidentFingerprint(alert),
    severity: alert.severity,
    title: alert.title,
    service: alert.service,
    environment: alert.environment,
    release: alert.release,
    correlation_id: alert.correlation_id,
    trace_id: alert.trace_id,
    status: "OPEN"
  });
  assert.equal(status.status, "OPEN");
  assert.equal(status.service, "worker");
  assert.equal(status.environment, "local");
  assert.equal(status.release, "release-1701");
  assert.equal(status.correlation_id, "corr-1701");
  assert.equal(status.trace_id, "trace-1701");
  assert.match(status.fingerprint, /^sha256:/);
});
