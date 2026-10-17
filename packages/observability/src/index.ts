export interface LogContext {
  service: string;
  environment: string;
  release: string;
  trace_id?: string;
  correlation_id?: string;
  operation: string;
  user_scope?: string;
  provider?: string;
}

export function redactedLog(context: LogContext, message: string, extra: Record<string, unknown> = {}): string {
  const safe = JSON.stringify({ timestamp: new Date().toISOString(), level: "info", ...context, message, ...extra });
  return safe.replace(/(token|secret|api[_-]?key|account[_-]?number)=?[^,}" ]+/gi, "$1=[REDACTED]");
}
