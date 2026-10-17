import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");

test("TC-US-0103: pull request CI runs blocking checks and uploads evidence", () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /name:\s+Lint[\s\S]*?run:\s+pnpm lint/);
  assert.match(workflow, /name:\s+Typecheck[\s\S]*?run:\s+pnpm typecheck/);
  assert.match(workflow, /name:\s+Tests[\s\S]*?run:\s+pnpm test/);
  assert.match(workflow, /uses:\s+actions\/upload-artifact@v4/);
  assert.match(workflow, /name:\s+ci-evidence-\$\{\{ github\.run_id \}\}/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
  assert.doesNotMatch(workflow, /run:\s+[^\n]*\|\|\s*true/);
});

test("TC-US-0103: CI artifact retains diagnostics even after a failed check", () => {
  const artifactStep = workflow.match(/- name: Upload CI evidence[\s\S]*?(?=\n\s+- name:|\n\s+security:)/)?.[0];
  assert.ok(artifactStep, "CI evidence upload step must exist");
  assert.match(artifactStep, /if:\s+\$\{\{ always\(\) \}\}/);
  assert.match(artifactStep, /path:/);
});
