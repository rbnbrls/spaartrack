import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";
const apiContainer = process.env.API_CONTAINER_NAME;
const runId = randomUUID();
const traceId = `synthetic-oauth-redaction-trace-${runId}`;
const correlationId = `synthetic-oauth-redaction-correlation-${runId}`;
const callbackCode = `synthetic-oauth-code-${runId}`;
const callbackState = `synthetic-oauth-state-${runId}`;
const codeVerifier = `synthetic-oauth-verifier-${runId}`;

function apiLogs() {
  return execFileSync("docker", ["logs", "--since", "5m", "--tail", "2000", apiContainer], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
}

test("TC-US-0106-C / TC-US-0203-B / TC-X-005: callback query secrets are redacted at request logging boundary", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  assert.ok(apiContainer, "API_CONTAINER_NAME must identify the isolated synthetic API container");

  const email = "synthetic-oauth-redaction@example.test";
  const created = await fetch(`${api}/api/v1/users`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trace-id": traceId, "x-correlation-id": correlationId },
    body: JSON.stringify({ email, display_name: "Synthetic OAuth Redaction User" })
  });
  assert.ok([201, 409].includes(created.status), "synthetic identity is created or already exists in this isolated DB");

  const loginStart = await fetch(`${api}/api/v1/oidc/start`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trace-id": traceId, "x-correlation-id": correlationId },
    body: JSON.stringify({ email, provider: "synthetic" })
  });
  assert.equal(loginStart.status, 201, "local synthetic OIDC authorization starts");
  const loginAuthorization = await loginStart.json();
  const loginCallback = await fetch(loginAuthorization.authorization_url, {
    headers: { "x-trace-id": traceId, "x-correlation-id": correlationId }
  });
  assert.equal(loginCallback.status, 200, "local synthetic OIDC callback issues an authenticated synthetic session");
  const session = await loginCallback.json();

  const requisition = await fetch(`${api}/api/v1/bank-requisitions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.token}`,
      "x-trace-id": traceId,
      "x-correlation-id": correlationId
    },
    body: JSON.stringify({
      institution_id: "synthetic-nl-bank",
      redirect_uri: "http://localhost:3000/bank/callback",
      language: "en",
      code_challenge: "a".repeat(43),
      fixture: "BANK-001"
    })
  });
  assert.equal(requisition.status, 201, "synthetic bank authorization callback setup succeeds");
  const authorization = await requisition.json();
  const callback = new URL(authorization.authorization_url);
  callback.searchParams.set("code", callbackCode);
  callback.searchParams.set("state", callbackState);
  callback.searchParams.set("code_verifier", codeVerifier);
  callback.searchParams.set("requisition_id", authorization.requisition_id);
  const response = await fetch(callback, {
    headers: { authorization: `Bearer ${session.token}`,
      "x-trace-id": traceId,
      "x-correlation-id": correlationId
    }
  });
  assert.equal(response.status, 401, "synthetic callback's deliberately invalid PKCE/state material is rejected");

  const logLines = apiLogs().split("\n");
  const callbackLogLines = logLines.filter((line) => line.includes(traceId) && line.includes('"operation":"request_received"') && line.includes("/api/v1/bank-requisitions/callback"));
  assert.equal(callbackLogLines.length, 1, "synthetic bank callback request log is observable exactly once");
  assert.ok(callbackLogLines[0].includes(correlationId), "request log retains the supplied correlation context");
  let exposedOAuthValueCount = 0;
  for (const [, value] of callbackLogLines[0].matchAll(/(?:\?|&)(?:code|state|code_verifier|requisition_id)=([^&\"]*)/g)) {
    if (value !== "[REDACTED]") exposedOAuthValueCount += 1;
  }
  assert.equal(exposedOAuthValueCount, 0, "actual callback log scan finds zero unredacted OAuth query values");
  for (const secret of [callbackCode, callbackState, codeVerifier]) {
    assert.equal(callbackLogLines.some((line) => line.includes(secret)), false, `${secret} must not appear in request logs`);
  }
});

test("request logging sanitizes OAuth query values without suppressing route or trace context", () => {
  const requestLoggingSource = apiSource.slice(apiSource.indexOf("const server = createServer"));
  assert.ok(requestLoggingSource.includes("redactedRequestPath"), "request logging uses the redaction boundary");
  assert.ok(requestLoggingSource.includes("path: redactedRequestPath(req.url)"), "request log retains a redacted route");
});
