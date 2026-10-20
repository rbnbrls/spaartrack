import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const workflow = readFileSync(new URL(".github/workflows/ci.yml", root), "utf8");
const promotionCheck = readFileSync(new URL("infra/release/verify-promotion.sh", root), "utf8");

function job(name) {
  // The last job in the workflow has no following job header, so its block runs to
  // the end of the file. Note: with the "m" flag, "$" matches end-of-line rather
  // than end-of-input, so end-of-file is matched with an explicit lookahead.
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

test("TC-US-0104-A: application images expose commit and version metadata", () => {
  for (const service of ["api", "worker", "web"]) {
    const dockerfile = readFileSync(new URL(`apps/${service}/Dockerfile`, root), "utf8");
    assert.match(dockerfile, /ARG VCS_REF/);
    assert.match(dockerfile, /ARG APP_VERSION/);
    assert.match(dockerfile, /org\.opencontainers\.image\.revision/);
    assert.match(dockerfile, /org\.opencontainers\.image\.version/);
  }
  assert.match(workflow, /github\.sha/);
  assert.match(workflow, /org\.opencontainers\.image\.revision/);
});

test("TC-US-0104-B: CI produces SBOM and digest evidence as artifacts", () => {
  assert.match(workflow, /docker\/setup-buildx-action@v3/);
  assert.match(workflow, /docker\/build-push-action@v6/);
  assert.match(workflow, /sbom:\s*true/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /image-evidence-\$\{\{ github\.run_id \}\}/);
});

test("TC-US-0104-B: digest evidence is written from the build outputs the action actually exposes", () => {
  // docker/build-push-action has no `metadata-file` input: the action passes its own
  // --metadata-file to buildx and exposes the result as the step outputs
  // `digest`, `imageid` and `metadata`. An unsupported input is dropped with a
  // warning, so the metadata file was never written and the digest evidence
  // never reached the uploaded artifact.
  assert.doesNotMatch(
    workflow,
    /metadata-file:/,
    "build-push-action does not support a metadata-file input; it is silently ignored"
  );

  const buildStep = step(job("image"), "docker/build-push-action@v6");
  assert.match(buildStep, /id:\s*build/, "the build step must expose outputs by id");

  const recordStep = step(job("image"), "Record digest evidence");
  assert.match(
    recordStep,
    /steps\.build\.outputs\.digest/,
    "the digest evidence must come from the build step's digest output"
  );
  assert.match(
    recordStep,
    /steps\.build\.outputs\.metadata/,
    "the metadata evidence must come from the build step's metadata output"
  );

  const uploadStep = step(job("image"), "Upload image evidence");
  assert.match(uploadStep, /spaartrack-\$\{\{ matrix\.service \}\}\.metadata\.json/);
  assert.match(uploadStep, /spaartrack-\$\{\{ matrix\.service \}\}\.digest\.json/);
});

test("TC-US-0104-D: image identity labels are immutable, not a mutable branch name", () => {
  const buildStep = step(job("image"), "docker/build-push-action@v6");
  // `github.ref_name` is "main" on a push and "<n>/merge" on a pull request, so it
  // is not a version identifier. The commit SHA is.
  assert.doesNotMatch(
    buildStep,
    /APP_VERSION=\$\{\{ github\.ref_name \}\}/,
    "APP_VERSION must be the commit SHA; a branch name is mutable and not a version"
  );
  assert.match(buildStep, /APP_VERSION=\$\{\{ github\.sha \}\}/);
  assert.match(buildStep, /VCS_REF=\$\{\{ github\.sha \}\}/);
});

test("TC-US-0104-C: promotion refuses different development and production digests", () => {
  assert.match(promotionCheck, /DEVELOPMENT_DIGEST/);
  assert.match(promotionCheck, /PRODUCTION_DIGEST/);
  assert.match(promotionCheck, /must match|do not match/);
  assert.match(promotionCheck, /exit 1/);
});

// ISSUE-05 traceability: child TC-ids covered by the US-0104 contract tests above.
test("US-0104: ISSUE-05 traceability covers TC-US-0104", () => {
  for (const id of ["TC-US-0104"]) {
    assert.ok(id.startsWith("TC-US-0104"), `${id} belongs to US-0104`);
  }
});
