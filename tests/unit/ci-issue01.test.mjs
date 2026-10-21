import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
const healthContract = readFileSync(new URL("../smoke/health-contract.test.mjs", import.meta.url), "utf8");
const coolify = readFileSync(new URL("../smoke/coolify-development.test.mjs", import.meta.url), "utf8");
const health = readFileSync(new URL("../smoke/health.test.mjs", import.meta.url), "utf8");

test("TC-US-0103 ISSUE-01: CI verify job provides Redis for readiness bootstrap", () => {
  // ISSUE-01 originally asserted services: redis + REDIS_URL. After Poort B
  // the stack is provided via compose.yaml — redis is still present via the
  // compose redis service. Accept either shape.
  const usesComposeStack = workflow.includes("docker compose up");
  const composeHasRedis = usesComposeStack && readFileSync(new URL("../../compose.yaml", import.meta.url), "utf8").includes("  redis:");
  assert.ok(workflow.includes("redis:") || composeHasRedis, "CI must provide redis (via services: or compose.yaml)");
  assert.ok(workflow.includes("REDIS_URL") || workflow.includes("redis:6379") || composeHasRedis, "CI must wire REDIS_URL or prove redis via compose stack");
});

test("TC-US-0105 ISSUE-01: stack-dependent smoke tests are gated behind STACK_SMOKE", () => {
  for (const [name, src] of [["health-contract", healthContract], ["coolify-development", coolify], ["health", health]]) {
    assert.match(src, /STACK_SMOKE/, `${name} must reference STACK_SMOKE`);
  }
});
