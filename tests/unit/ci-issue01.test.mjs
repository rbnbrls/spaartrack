import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
const healthContract = readFileSync(new URL("../smoke/health-contract.test.mjs", import.meta.url), "utf8");
const coolify = readFileSync(new URL("../smoke/coolify-development.test.mjs", import.meta.url), "utf8");
const health = readFileSync(new URL("../smoke/health.test.mjs", import.meta.url), "utf8");

test("TC-US-0103 ISSUE-01: CI verify job provides Redis for readiness bootstrap", () => {
  assert.match(workflow, /redis:/);
  assert.match(workflow, /REDIS_URL|redis:6379/);
});

test("TC-US-0105 ISSUE-01: stack-dependent smoke tests are gated behind STACK_SMOKE", () => {
  for (const [name, src] of [["health-contract", healthContract], ["coolify-development", coolify], ["health", health]]) {
    assert.match(src, /STACK_SMOKE/, `${name} must reference STACK_SMOKE`);
  }
});
