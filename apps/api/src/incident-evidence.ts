const secretKeys = /token|secret|password|authorization|api[_-]?key|credential/i;
const accountKeys = /account[_-]?number|iban|routing[_-]?number/i;

export interface IncidentEvidenceInput {
  incident_id: string;
  correlation_id: string;
  trace_id: string;
  logs?: unknown[];
  traces?: unknown[];
  metrics?: unknown[];
  deploys?: unknown[];
  migrations?: unknown[];
  release: {
    release: string;
    commit_sha: string;
    image_digest: string;
    migration_result: string;
  };
  runbooks?: string[];
}

function requiredText(value: unknown, name: string, max = 240): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > max) throw new Error(`INVALID_INCIDENT_EVIDENCE_${name.toUpperCase()}`);
  return text;
}

function redactText(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED_SECRET]");
}

export function redactEvidenceValue(value: unknown, key = ""): unknown {
  if (secretKeys.test(key)) return "[REDACTED_SECRET]";
  if (accountKeys.test(key)) return "[REDACTED_ACCOUNT]";
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map((item) => redactEvidenceValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redactEvidenceValue(childValue, childKey)]));
  }
  return value;
}

function list(value: unknown, name: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw new Error(`INVALID_INCIDENT_EVIDENCE_${name.toUpperCase()}`);
  return value.map((item) => redactEvidenceValue(item));
}

export function buildIncidentEvidenceBundle(input: IncidentEvidenceInput): IncidentEvidenceInput & {
  calculation_version: "incident-evidence-v1";
  pii_redacted: true;
  redacted_exemplars: true;
  read_only: true;
  logs: unknown[];
  traces: unknown[];
  metrics: unknown[];
  deploys: unknown[];
  migrations: unknown[];
  runbooks: string[];
} {
  const incidentId = requiredText(input.incident_id, "incident_id");
  const correlationId = requiredText(input.correlation_id, "correlation_id");
  const traceId = requiredText(input.trace_id, "trace_id");
  const release = {
    release: requiredText(input.release?.release, "release"),
    commit_sha: requiredText(input.release?.commit_sha, "commit_sha", 80),
    image_digest: requiredText(input.release?.image_digest, "image_digest", 100),
    migration_result: requiredText(input.release?.migration_result, "migration_result")
  };
  if (!/^(local|[0-9a-f]{7,64})$/i.test(release.commit_sha) && !/^local-/i.test(release.commit_sha)) throw new Error("INVALID_INCIDENT_EVIDENCE_COMMIT_SHA");
  if (!/^sha256:[0-9a-f]{64}$/i.test(release.image_digest) && release.image_digest !== "local") throw new Error("INVALID_INCIDENT_EVIDENCE_IMAGE_DIGEST");
  const runbooks = input.runbooks === undefined ? [] : input.runbooks.map((value) => requiredText(value, "runbook", 240));
  if (runbooks.some((value) => !value.startsWith("docs/runbooks/"))) throw new Error("INVALID_INCIDENT_EVIDENCE_RUNBOOK");
  return {
    ...input,
    incident_id: incidentId,
    correlation_id: correlationId,
    trace_id: traceId,
    release,
    logs: list(input.logs, "logs"),
    traces: list(input.traces, "traces"),
    metrics: list(input.metrics, "metrics"),
    deploys: list(input.deploys, "deploys"),
    migrations: list(input.migrations, "migrations"),
    runbooks,
    calculation_version: "incident-evidence-v1",
    pii_redacted: true,
    redacted_exemplars: true,
    read_only: true
  };
}
