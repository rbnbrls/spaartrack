import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const workerSource = readFileSync(new URL("apps/worker/src/index.ts", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0106-A: API request and response carry trace context", async () => {
  const response = await fetch(`${api}/api/v1`, {
    headers: {
      "x-trace-id": "trace-synthetic-0106",
      "x-correlation-id": "corr-synthetic-0106"
    }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-trace-id"), "trace-synthetic-0106");
  assert.equal(response.headers.get("x-correlation-id"), "corr-synthetic-0106");
  const body = await response.json();
  assert.equal(body.trace_id, "trace-synthetic-0106");
  assert.equal(body.correlation_id, "corr-synthetic-0106");
  assert.equal(body.service, "api");
  assert.equal(typeof body.release, "string");
  assert.match(apiSource, /redact|REDACTED/i);
});

test("TC-US-0106-B: worker job logs contain traceable job context", () => {
  for (const field of ["trace_id", "correlation_id", "job_id", "service", "release"]) {
    assert.match(workerSource, new RegExp(field));
  }
  assert.match(workerSource, /job_consumed/);
});

test("TC-US-0106-C: observability redacts sensitive synthetic fields", () => {
  for (const field of ["token", "secret", "api[_-]?key", "account[_-]?number", "transaction[_-]?description"]) {
    assert.match(`${apiSource}\n${workerSource}`, new RegExp(field, "i"));
  }
  assert.match(`${apiSource}\n${workerSource}`, /REDACTED/);
});
