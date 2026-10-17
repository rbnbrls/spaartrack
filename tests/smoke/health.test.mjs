import test from "node:test";
import assert from "node:assert/strict";

const api = process.env.API_URL || "http://localhost:18080";

test("API liveness endpoint reports healthy", async () => {
  const response = await fetch(api + "/health/live");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ok");
});

test("API readiness endpoint reports dependency contract", async () => {
  const response = await fetch(api + "/health/ready");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ready");
  assert.equal(body.dependencies.database.status, "ready");
  assert.equal(typeof body.dependencies.database.reason, "string");
});
