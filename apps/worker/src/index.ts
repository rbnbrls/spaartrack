import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createConnection, type Socket } from "node:net";

const release = process.env.APP_RELEASE || "local";
const environment = process.env.APP_ENV || "local";
const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379/0");
const queue = process.env.WORKER_QUEUE || "spaartrack:jobs";
let redis: Socket | undefined;

function safeLog(fields: Record<string, unknown>): void {
  const output = JSON.stringify(fields)
    .replace(/("(?:token|secret|api_key|api-key|account_number|account-number|transaction_description|transaction-description|description)"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
    .replace(/(token|secret|api_key|api-key|account_number|account-number)=?[^,}" ]+/gi, "$1=[REDACTED]");
  console.log(output);
}

const workerTraceId = randomUUID();
const workerCorrelationId = randomUUID();

safeLog({
  timestamp: new Date().toISOString(),
  level: "info",
  service: "worker",
  environment,
  release,
  trace_id: workerTraceId,
  correlation_id: workerCorrelationId,
  operation: "worker_started",
  message: "Worker bootstrap is ready; Redis queue consumer is listening"
});

function command(...parts: string[]): string {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join("")}`;
}

function consumeOneJob(): void {
  redis = createConnection({ host: redisUrl.hostname, port: Number(redisUrl.port || 6379) });
  let buffer = "";
  redis.on("connect", () => {
    try {
      writeFileSync("/tmp/spaartrack-worker-ready", "ready\n");
    } catch {
      // The container health check is best effort in non-container test runs.
    }
    const database = redisUrl.pathname.slice(1) || "0";
    redis?.write(command("SELECT", database));
    redis?.write(command("BLPOP", queue, "0"));
  });
  redis.on("data", (chunk) => {
    buffer += chunk.toString();
    if (buffer.startsWith("+OK\r\n")) buffer = buffer.slice(5);
    if (!buffer.startsWith("*2\r\n")) return;
    const response = buffer.match(/^\*2\r\n\$\d+\r\n[^\r\n]+\r\n\$\d+\r\n([^\r\n]+)\r\n/);
    if (!response) return;
    const payload = response[1];
    let jobId = payload;
    let traceId: string = workerTraceId;
    let correlationId: string = workerCorrelationId;
    try {
      const job = JSON.parse(payload) as Record<string, unknown>;
      if (typeof job.job_id === "string") jobId = job.job_id;
      if (typeof job.trace_id === "string") traceId = job.trace_id;
      if (typeof job.correlation_id === "string") correlationId = job.correlation_id;
    } catch {
      // Legacy queue payloads remain traceable through generated context.
    }
    safeLog({
      timestamp: new Date().toISOString(),
      level: "info",
      service: "worker",
      release,
      trace_id: traceId,
      correlation_id: correlationId,
      operation: "job_consumed",
      queue,
      job_id: jobId
    });
    if (process.env.WORKER_RUN_ONCE === "1") shutdown("JOB_CONSUMED");
    buffer = "";
  });
  redis.on("error", (error) => {
    safeLog({ level: "error", service: "worker", release, trace_id: workerTraceId, correlation_id: workerCorrelationId, operation: "redis_error", message: error.message });
  });
}

consumeOneJob();

function shutdown(signal: string): void {
  redis?.destroy();
  safeLog({ level: "info", service: "worker", release, trace_id: workerTraceId, correlation_id: workerCorrelationId, operation: "worker_stopped", signal });
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
setInterval(() => undefined, 30000);
