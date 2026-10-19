import { createHash } from "node:crypto";

export const INCIDENT_GROUPING_WINDOW_MINUTES = 15;
const severities = ["SEV-3", "SEV-2", "SEV-1", "SEV-0"] as const;
export type IncidentSeverity = typeof severities[number];

export interface IncidentAlertInput {
  title: string;
  service: string;
  environment: string;
  release: string;
  severity: IncidentSeverity;
  message: string;
  occurred_at?: string;
  correlation_id: string;
  trace_id: string;
}

function required(value: unknown, name: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > 240) throw new Error(`INVALID_INCIDENT_${name.toUpperCase()}`);
  return text;
}

function normalizedCause(input: Pick<IncidentAlertInput, "title" | "service" | "environment" | "release" | "message">): string {
  return [input.title, input.service, input.environment, input.release, input.message]
    .map((value) => value.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

export function incidentFingerprint(input: Pick<IncidentAlertInput, "title" | "service" | "environment" | "release" | "message">): string {
  return `sha256:${createHash("sha256").update(normalizedCause(input)).digest("hex")}`;
}

export function buildIncidentAlert(input: IncidentAlertInput): IncidentAlertInput & {
  fingerprint: string;
  grouping_window_minutes: number;
  read_only: true;
} {
  const severity = required(input.severity, "severity") as IncidentSeverity;
  if (!severities.includes(severity)) throw new Error("INVALID_INCIDENT_SEVERITY");
  const alert = {
    title: required(input.title, "title"),
    service: required(input.service, "service"),
    environment: required(input.environment, "environment"),
    release: required(input.release, "release"),
    severity,
    message: required(input.message, "message"),
    occurred_at: input.occurred_at || new Date().toISOString(),
    correlation_id: required(input.correlation_id, "correlation_id"),
    trace_id: required(input.trace_id, "trace_id")
  };
  if (Number.isNaN(Date.parse(alert.occurred_at))) throw new Error("INVALID_INCIDENT_OCCURRED_AT");
  return { ...alert, fingerprint: incidentFingerprint(alert), grouping_window_minutes: INCIDENT_GROUPING_WINDOW_MINUTES, read_only: true };
}

export function mergeIncidentStatus(input: IncidentAlertInput & { fingerprint: string; status: string }): IncidentAlertInput & { fingerprint: string; status: string } {
  return { ...input, status: input.status || "OPEN" };
}

export function severityRank(value: string): number {
  return Math.max(0, severities.indexOf(value as IncidentSeverity));
}
