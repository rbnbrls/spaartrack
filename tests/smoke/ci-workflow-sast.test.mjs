import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");

function job(name) {
  const match = workflow.match(
    new RegExp(`^ {2}${name}:\\n[\\s\\S]*?(?=^ {2}[A-Za-z][\\w-]*:\\n|(?![\\s\\S]))`, "m")
  );
  assert.ok(match, `workflow must contain a ${name} job`);
  return match[0];
}

function step(jobSource, marker) {
  const found = jobSource.split(/\n(?=\s{6}- )/).find((candidate) => candidate.includes(marker));
  assert.ok(found, `job must contain a step matching ${marker}`);
  return found;
}

test("TC-US-0106: security job includes a blocking SAST step", () => {
  const securityJob = job("security");
  const sastStep = step(securityJob, "SAST");
  assert.doesNotMatch(sastStep, /continue-on-error:\s*true/, "SAST step must not have continue-on-error: true");
  assert.doesNotMatch(sastStep, /continueOnError:\s*true/, "SAST step must not have continue-on-error: true");
  assert.doesNotMatch(sastStep, /\|\|\s*true/, "SAST step must not contain '|| true'");
  assert.match(sastStep, /(semgrep|codeql|sast)/i, "SAST step should reference a SAST tool");
});

test("TC-US-0106: SAST step uploads evidence (SARIF or artifact)", () => {
  const securityJob = job("security");
  const sastStep = step(securityJob, "SAST");
  const hasEvidence = /upload-sarif|upload-artifact|sarif-file/i.test(sastStep) || /actions\/upload-sarif/i.test(securityJob) || /sarif/i.test(securityJob);
  assert.ok(hasEvidence, "SAST step must produce/upload SARIF or an artifact");
});
