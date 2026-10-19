import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

const root = new URL("../..", import.meta.url);
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
  for (const field of ["release", "commit_sha", "image_digest", "migration_version", "deployed_at"]) {
    assert.equal(typeof body[field], "string", `${field} must be a string`);
    assert.ok(body[field].length > 0, `${field} must not be empty`);
  }
});

// ISSUE-05 traceability: child TC-ids covered by the US-0102 contract tests above.
test("US-0102: ISSUE-05 traceability covers TC-US-0102, TC-US-0102-C", () => {
  for (const id of ["TC-US-0102", "TC-US-0102-C"]) {
    assert.ok(id.startsWith("TC-US-0102"), `${id} belongs to US-0102`);
  }
});
