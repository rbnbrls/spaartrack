import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const api = process.env.API_URL || "http://localhost:18080";
const logContainer = process.env.API_CONTAINER_NAME || process.env.API_LOG_CONTAINER || "spaartrack-api-1";

test("TC-US-0203-B / TC-US-0106-C / TC-X-005: OAuth callback query values never reach request logs", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const traceId = `synthetic-oauth-log-trace-${Date.now()}`;
  const correlationId = `synthetic-oauth-log-correlation-${Date.now()}`;
  const values = {
    state: `synthetic-oauth-state-${Date.now()}`,
    code: `synthetic-oauth-code-${Date.now()}`,
    code_verifier: `synthetic-oauth-verifier-${Date.now()}`
  };
  const callback = new URL("/api/v1/bank-requisitions/callback", api);
  for (const [key, value] of Object.entries(values)) callback.searchParams.set(key, value);

  const response = await fetch(callback, {
    headers: { "x-trace-id": traceId, "x-correlation-id": correlationId }
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("x-trace-id"), traceId);
  assert.equal(response.headers.get("x-correlation-id"), correlationId);

  const logs = execFileSync("docker", ["logs", "--since", "1m", logContainer], { encoding: "utf8" });
  const requestLog = logs.split("\n").find((line) => line.includes(correlationId));
  assert.ok(requestLog, "request log retains the correlation identifier");
  assert.ok(requestLog.includes(traceId), "request log retains the trace identifier");
  assert.ok(requestLog.includes("/api/v1/bank-requisitions/callback"), "request log retains the callback route");
  for (const value of Object.values(values)) assert.ok(!requestLog.includes(value), "OAuth callback value must not appear in its request log");
  for (const key of Object.keys(values)) assert.ok(requestLog.includes(`${key}=`), `request log retains the safe ${key} query key`);
  assert.equal(decodeURIComponent(requestLog).split("[REDACTED]").length - 1, Object.keys(values).length, "request log redacts each callback query value without suppressing the request event");
});
