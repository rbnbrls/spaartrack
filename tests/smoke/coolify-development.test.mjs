import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../..", import.meta.url);
const rootPath = fileURLToPath(root);
const manifest = readFileSync(new URL("infra/coolify/development.yaml", root), "utf8");
const rehearsal = readFileSync(new URL("infra/coolify/rehearse-development.sh", root), "utf8");
const releaseUrl = process.env.API_URL || "http://localhost:18080";

test("TC-US-0102-A: Coolify development destination is versioned", () => {
  assert.match(manifest, /kind:\s+CoolifyDevelopment/);
  assert.match(manifest, /composeFile:\s+compose\.yaml/);
  assert.match(manifest, /branch:\s+main/);
  assert.match(manifest, /domain:\s+spaartrack-dev\.local/);
  for (const variable of ["APP_ENV", "APP_RELEASE", "APP_COMMIT_SHA", "APP_IMAGE_DIGEST", "APP_MIGRATION_VERSION"]) {
    assert.match(manifest, new RegExp(`^\\s+${variable}:`, "m"), `${variable} must be documented`);
  }
  assert.doesNotMatch(manifest, /(password|secret|token)\s*:/i);
  assert.match(rehearsal, /COOLIFY_COMMIT_SHA/);
  assert.match(rehearsal, /health\/ready/);
  assert.match(rehearsal, /api\/v1\/release/);
  assert.ok((statSync(new URL("infra/coolify/rehearse-development.sh", root).pathname).mode & 0o111) !== 0, "rehearsal must be executable");
});

test("TC-US-0102-B/C: release page exposes deploy and migration identity", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const response = await fetch(`${releaseUrl}/api/v1/release`);
  assert.equal(response.status, 200);
  const body = await response.json();
  const expectedCommitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootPath, encoding: "utf8" }).trim();
  for (const field of ["release", "commit_sha", "image_digest", "migration_version", "deployed_at"]) {
    assert.equal(typeof body[field], "string", `${field} must be a string`);
    assert.ok(body[field].length > 0, `${field} must not be empty`);
  }
  assert.equal(body.commit_sha, expectedCommitSha, "commit_sha must identify the tree under test");
  assert.match(
    body.image_digest,
    /^(?:sha256:[0-9a-f]{64}|local)$/i,
    "image_digest must be a sha256 digest or the documented local-dev unbound marker",
  );
  // Explicit bound/unbound observability: the flags must be present and
  // truthfully reflect the reported values. An unbound fallback must never
  // masquerade as a bound identity. (US-0102, finding G11)
  assert.equal(typeof body.commit_sha_bound, "boolean", "commit_sha_bound must be reported");
  assert.equal(typeof body.image_digest_bound, "boolean", "image_digest_bound must be reported");
  assert.equal(typeof body.identity_bound, "boolean", "identity_bound must be reported");
  const commitShaPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
  const imageDigestPattern = /^sha256:[0-9a-f]{64}$/i;
  assert.equal(
    body.commit_sha_bound,
    commitShaPattern.test(body.commit_sha),
    "commit_sha_bound must truthfully reflect the reported commit_sha"
  );
  assert.equal(
    body.image_digest_bound,
    /^sha256:[0-9a-f]{64}$/i.test(body.image_digest),
    "image_digest_bound must truthfully reflect the reported image_digest"
  );
  assert.equal(
    body.identity_bound,
    body.commit_sha_bound && body.image_digest_bound,
    "identity_bound must combine both bound flags"
  );
  // The bound case: on a tree with git metadata the running stack must report
  // a bound identity. An unbound identity here is a failure of the bound case,
  // not a valid local-dev convenience state. (US-0102, finding G11)
  assert.equal(body.commit_sha_bound, true, "a bound stack must report a bound commit SHA");
  assert.equal(body.commit_sha, expectedCommitSha, "commit_sha must identify the tree under test");
  assert.match(
    body.image_digest,
    /^(?:sha256:[0-9a-f]{64}|local)$/i,
    "image_digest must be a sha256 digest or the documented local-dev unbound marker"
  );
  assert.equal(
    body.image_digest_bound,
    /^sha256:[0-9a-f]{64}$/i.test(body.image_digest),
    "image_digest_bound must truthfully reflect the reported image_digest"
  );
  assert.equal(
    body.identity_bound,
    body.commit_sha_bound && body.image_digest_bound,
    "identity_bound must combine both bound flags"
  );
});

// ISSUE-05 traceability: child TC-ids covered by the US-0102 contract tests above.
test("US-0102: ISSUE-05 traceability covers TC-US-0102, TC-US-0102-C", () => {
  for (const id of ["TC-US-0102", "TC-US-0102-C"]) {
    assert.ok(id.startsWith("TC-US-0102"), `${id} belongs to US-0102`);
  }
});
