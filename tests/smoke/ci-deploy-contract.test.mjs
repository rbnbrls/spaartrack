import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const workflow = readFileSync(new URL(".github/workflows/ci.yml", root), "utf8");

function jobBlock(name) {
  const start = workflow.search(new RegExp(`^  ${name}:\\s*$`, "m"));
  assert.notEqual(start, -1, `CI workflow must define the ${name} job`);
  const rest = workflow.slice(start);
  const body = rest.slice(rest.indexOf("\n") + 1);
  const nextJob = body.search(/^  [a-zA-Z0-9_-]+:\s*$/m);
  return nextJob === -1 ? rest : rest.slice(0, nextJob + rest.indexOf("\n") + 1);
}

function stepBlocks(job) {
  return job.split(/(?=^      - )/m).filter((step) => /^      - /m.test(step));
}

function isPushToMainGate(step) {
  const condition = step.match(/^\s+if:\s*(.+)$/m)?.[1] || "";
  const normalized = condition.replace(/[${}{'\"]|\\/g, "").replace(/\s+/g, " ").trim();
  return normalized.includes("github.event_name == push") && normalized.includes("github.ref == refs/heads/main");
}

test("TC-US-0102/TC-US-0104: CI promotion and deployment are push-to-main only", () => {
  const image = jobBlock("image");
  const imageSteps = stepBlocks(image);
  const login = imageSteps.find((step) => /docker\/login-action@/m.test(step));
  const pushes = imageSteps.filter((step) => /^\s+push:\s*true\s*$/m.test(step));

  assert.ok(login, "image job must log in to the registry in a dedicated step");
  assert.ok(isPushToMainGate(login), "registry login must be gated to push events on main");
  assert.ok(pushes.length > 0, "image job must contain an explicit image push step");
  for (const push of pushes) {
    assert.ok(isPushToMainGate(push), "every image push must be gated to push events on main");
  }

  const deploy = jobBlock("deploy");
  assert.match(deploy, /^    needs:\s*\[?[^\n]*\bverify\b[^\n]*\bsecurity\b[^\n]*\bimage\b/m,
    "deploy must depend on verify, security, and image");
  assert.match(deploy, /^    if:\s*(.+)$/m, "deploy must declare an execution condition");
  assert.ok(isPushToMainGate(deploy), "deploy must run only for push events on main");
});
