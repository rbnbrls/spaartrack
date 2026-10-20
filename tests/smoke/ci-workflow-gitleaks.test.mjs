import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// TC-US-0103 — contract for the `security` job of .github/workflows/ci.yml.
//
// Scope: the secret scan must be able to run on a pull request (token +
// permissions) and the job must stay a blocking gate.
//
// This file is deliberately self-contained. It does not import from
// tests/smoke/ci-workflow.test.mjs (which covers the API entrypoint and the
// checkout depth): the two landings are reviewed independently, so neither
// depends on the other's helpers.

const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
const lines = workflow.split("\n");

function indentOf(line) {
  return line.length - line.trimStart().length;
}

/** The raw YAML text of a single job, e.g. "security". */
function jobSource(name) {
  const start = lines.findIndex((line) => line === `  ${name}:`);
  assert.notEqual(start, -1, `workflow must contain a ${name} job`);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") continue;
    if (indentOf(line) <= 2) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

/** Every step of a job, each as its own block of YAML text. */
function stepSources(jobText) {
  const blocks = [];
  let current = null;
  for (const line of jobText.split("\n")) {
    if (/^ {6}- /.test(line)) {
      current = [line];
      blocks.push(current);
    } else if (current) {
      current.push(line);
    }
  }
  return blocks.map((block) => block.join("\n"));
}

function stepNamed(jobText, name) {
  const found = stepSources(jobText).find((block) => block.includes(`- name: ${name}`));
  assert.ok(found, `job must contain a step named "${name}"`);
  return found;
}

/** The mapping entries under a step's "env:" key, as text. */
function stepEnv(stepText) {
  const stepLines = stepText.split("\n");
  const start = stepLines.findIndex((line) => line.trim() === "env:");
  if (start === -1) return "";
  const entries = [];
  for (const line of stepLines.slice(start + 1)) {
    if (line.trim() === "") continue;
    if (indentOf(line) <= 8) break;
    entries.push(line.trim());
  }
  return entries.join("\n");
}

/** The mapping entries under a job's "permissions:" key, as text. */
function jobPermissions(jobText) {
  const jobLines = jobText.split("\n");
  const start = jobLines.findIndex((line) => line.trim() === "permissions:");
  assert.notEqual(start, -1, "job must declare an explicit permissions block");
  const entries = [];
  for (const line of jobLines.slice(start + 1)) {
    if (line.trim() === "") continue;
    if (indentOf(line) <= 4) break;
    entries.push(line.trim());
  }
  return entries.join("\n");
}

const securityJob = jobSource("security");
const imageJob = jobSource("image");

test("TC-US-0103: the secret scan receives GITHUB_TOKEN so it can scan pull requests", () => {
  const secretScan = stepNamed(securityJob, "Secret scan");
  assert.match(secretScan, /uses:\s+gitleaks\/gitleaks-action@v\d+/);

  const env = stepEnv(secretScan);
  assert.match(
    env,
    /GITHUB_TOKEN:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/,
    "gitleaks-action exits 1 on a pull_request event when GITHUB_TOKEN is absent, before it scans"
  );
  assert.doesNotMatch(
    env,
    /GITLEAKS_LICENSE/,
    "rbnbrls/spaartrack is a personal account: upstream requires no license key"
  );
});

test("TC-US-0103: the security job may report a leak on the pull request", () => {
  assert.match(
    jobPermissions(securityJob),
    /pull-requests:\s*write/,
    "gitleaks-action comments the leak on the PR through the GitHub API"
  );
});

test("TC-US-0103: the secret scan runs on a supported gitleaks-action major version", () => {
  const secretScan = stepNamed(securityJob, "Secret scan");
  const version = secretScan.match(/gitleaks\/gitleaks-action@v(\d+)/)?.[1];
  assert.ok(version, "the secret scan step must pin a gitleaks-action major version");
  assert.ok(
    Number(version) >= 3,
    `gitleaks-action@v${version} targets Node 20, which GitHub removes from hosted runners on 2026-09-16; v3 (Node 24) is required`
  );
  assert.doesNotMatch(
    workflow,
    /gitleaks\/gitleaks-action@v2\b/,
    "no gitleaks-action@v2 reference may remain in the workflow"
  );
});

test("TC-US-0103: the security job stays a blocking gate", () => {
  for (const name of ["Secret scan", "Dependency audit"]) {
    const step = stepNamed(securityJob, name);
    assert.doesNotMatch(
      step,
      /continue-on-error:\s*true/,
      `the "${name}" step must not continue-on-error`
    );
    assert.doesNotMatch(step, /\|\|\s*true/, `the "${name}" step must not swallow its exit code`);
    assert.doesNotMatch(
      step,
      /if:\s*.*\b(always|failure|cancelled)\(\)/,
      `the "${name}" step must not be excused with if: always()/failure()/cancelled()`
    );
  }
  assert.doesNotMatch(securityJob, /continue-on-error:\s*true/);
  assert.doesNotMatch(securityJob, /\|\|\s*true/);
});

test("TC-US-0103: the security job scans the full history", () => {
  const checkout = stepSources(securityJob).find((block) => block.includes("actions/checkout@"));
  assert.ok(checkout, "the security job must check out the repository");
  assert.match(
    checkout,
    /fetch-depth:\s*0/,
    "gitleaks scans a <before>^..<after> range and needs a full clone (fetch-depth: 0)"
  );
});

// TC-US-0103 — the push path must scan the commits the push actually introduced.
//
// gitleaks-action@v3 derives the push range from the payload's FIRST commit
// (payload.commits[0].id) and hardcodes `--no-merges --first-parent`. On a
// merge-commit push that combination collapses to zero commits: the merge
// commit is excluded by --no-merges and every commit on its first-parent path
// is excluded by the range start. Run 39425432922 therefore reported
// "INF 0 commits scanned. / INF no leaks found" — a vacuous green.
//
// The action stays on pull_request events (it annotates the PR through the
// GitHub API and its range is correct there), while push events run gitleaks
// directly with the explicit before..after range of the pushed commits.
test("TC-US-0103: the push secret scan scans the pushed commit range, not an empty one", () => {
  const action = stepNamed(securityJob, "Secret scan");
  assert.match(
    action,
    /if:\s*github\.event_name\s*!=\s*'push'/,
    "the gitleaks-action range collapses to 0 commits on a merge-commit push, so it must not run on push events"
  );

  const pushScan = stepNamed(securityJob, "Push secret scan");
  assert.match(
    pushScan,
    /github\.event\.before/,
    "the push scan must start at the SHA the push replaced"
  );
  assert.match(
    pushScan,
    /github\.sha/,
    "the push scan must end at the SHA the push introduced"
  );

  const logOpts = pushScan.match(/--log-opts="([^"]*)"/)?.[1] ?? "";
  assert.ok(logOpts, "the push scan must pass an explicit range to gitleaks");
  assert.match(
    logOpts,
    /\$\{SCAN_BASE\}\.\.\$\{SCAN_HEAD\}/,
    "the push scan must scan the explicit before..after range of the push"
  );
  assert.doesNotMatch(
    logOpts,
    /(^|\s)--first-parent(\s|$)/,
    "a first-parent walk drops the merged branch and collapses the range to zero commits on a merge-commit push"
  );

  assert.match(
    pushScan,
    /rev-list\s+--count/,
    "the push scan must count the commits in its range and fail when the range is empty, so a collapsed range can never report a vacuous green"
  );
  assert.doesNotMatch(pushScan, /continue-on-error:\s*true/);
  assert.doesNotMatch(pushScan, /\|\|\s*true/);
  assert.doesNotMatch(pushScan, /if:\s*.*\b(always|failure|cancelled)\(\)/);
});

test("TC-US-0103: the image gate still depends on both the verify and the security job", () => {
  const needs = imageJob.match(/^\s{4}needs:\s*\[(.*)\]\s*$/m)?.[1] ?? "";
  const required = needs
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const job of ["verify", "security"]) {
    assert.ok(
      required.includes(job),
      `image.needs must still contain ${job} (found: [${required.join(", ")}])`
    );
  }
});
