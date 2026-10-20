import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
const apiPackage = JSON.parse(readFileSync(new URL("../../apps/api/package.json", import.meta.url), "utf8"));

// The API build emits its entrypoint relative to the inferred tsc rootDir, which
// shifts whenever apps/api starts importing from packages/. Derive the emitted
// path from the package start script instead of hardcoding it.
const apiEntrypoint = apiPackage.scripts.start.replace(/^node\s+/, "").replace(/^dist\//, "");
const apiEntrypointDistPath = `apps/api/dist/${apiEntrypoint}`;

function job(name) {
  const match = workflow.match(new RegExp(`^ {2}${name}:\\n[\\s\\S]*?(?=^ {2}[A-Za-z][\\w-]*:\\n)`, "m"));
  assert.ok(match, `workflow must contain a ${name} job`);
  return match[0];
}

function step(jobSource, marker) {
  const found = jobSource.split(/\n(?=\s{6}- )/).find((candidate) => candidate.includes(marker));
  assert.ok(found, `job must contain a step matching ${marker}`);
  return found;
}

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

test("TC-US-0105: CI bootstraps the API entrypoint that the build actually emits", () => {
  const bootstrapStep = step(job("verify"), "- name: Start API bootstrap");
  assert.doesNotMatch(
    bootstrapStep,
    /apps\/api\/dist\/index\.js/,
    "stale API entrypoint path must be gone from the bootstrap step"
  );
  const startsEmittedEntrypoint =
    bootstrapStep.includes(apiEntrypointDistPath) ||
    new RegExp(`pnpm\\s+--filter\\s+${apiPackage.name}\\s+start`).test(bootstrapStep);
  assert.ok(
    startsEmittedEntrypoint,
    `bootstrap step must start ${apiEntrypointDistPath} (or "pnpm --filter ${apiPackage.name} start")`
  );
});

test("TC-US-0103: security job checks out full history so the gitleaks range resolves", () => {
  const checkoutStep = step(job("security"), "- uses: actions/checkout@v4");
  assert.match(
    checkoutStep,
    /fetch-depth:\s*0/,
    "gitleaks scans a <before>^..<after> range and needs a full clone (fetch-depth: 0)"
  );
});
