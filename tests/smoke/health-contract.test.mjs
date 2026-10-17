import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const api = process.env.API_URL || "http://localhost:18080";
const web = process.env.WEB_URL || "http://localhost:3000";
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const workerSource = readFileSync(new URL("apps/worker/src/index.ts", root), "utf8");
const compose = readFileSync(new URL("compose.yaml", root), "utf8");

test("TC-US-0105-A: API liveness is process-only", async () => {
  const response = await fetch(`${api}/health/live`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ok");
  const liveBranch = apiSource.match(/req\.url === "\/health\/live"[\s\S]*?\n\s*}\n/)?.[0] || "";
  assert.doesNotMatch(liveBranch, /database|redis|dependency|checkTcp/i);
});

test("TC-US-0105-B: API readiness reports each dependency with a reason", async () => {
  const response = await fetch(`${api}/health/ready`);
  assert.equal(response.status, 200);
  const body = await response.json();
  for (const dependency of ["database", "redis"]) {
    assert.equal(body.dependencies[dependency].status, "ready");
    assert.equal(typeof body.dependencies[dependency].reason, "string");
    assert.ok(body.dependencies[dependency].reason.length > 0);
  }
  assert.match(apiSource, /"not_ready"/);
  assert.match(apiSource, /connection_failed|timeout|unavailable/);
});

test("TC-US-0105: web and worker have separate readiness checks", async () => {
  const webResponse = await fetch(`${web}/health/live`);
  assert.equal(webResponse.status, 200);
  const webReadyResponse = await fetch(`${web}/health/ready`);
  assert.equal(webReadyResponse.status, 200);
  assert.match(compose, /http:\/\/127\.0\.0\.1\/health\/ready/);
  assert.match(compose, /worker readiness marker missing/);
  assert.match(workerSource, /redis\.on\("connect"/);
});
