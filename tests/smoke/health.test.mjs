import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const api = apiUrl;

test("API liveness endpoint reports healthy", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const response = await fetch(api + "/health/live");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ok");
});

test("API readiness endpoint reports dependency contract", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const response = await fetch(api + "/health/ready");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ready");
  assert.equal(body.dependencies.database.status, "ready");
  assert.equal(typeof body.dependencies.database.reason, "string");
});
