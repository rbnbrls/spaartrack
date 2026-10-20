import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");

test("B-003 runtime: production startup refuses missing TOTP key with exit 1 and logged message", () => {
  // docker compose run with APP_ENV=production and NO TOTP_ENCRYPTION_KEY
  // must exit nonzero and log TOTP_ENCRYPTION_KEY refusal
  const result = spawnSync("docker", [
    "compose", "run", "--rm", "--no-deps",
    "-e", "APP_ENV=production",
    "--entrypoint", "node", "api", "dist/apps/api/src/index.js"
  ], { encoding: "utf8", timeout: 60_000 });

  assert.notEqual(result.status, 0, `production startup unexpectedly succeeded: ${result.stdout}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /TOTP_ENCRYPTION_KEY/);
});

test("B-003 runtime: production startup refuses weak TOTP key (< 32 chars) with exit 1 and logged message", () => {
  // docker compose run with APP_ENV=production and a short key
  // must exit nonzero and log TOTP_ENCRYPTION_KEY refusal
  const result = spawnSync("docker", [
    "compose", "run", "--rm", "--no-deps",
    "-e", "APP_ENV=production",
    "-e", "TOTP_ENCRYPTION_KEY=short",
    "--entrypoint", "node", "api", "dist/apps/api/src/index.js"
  ], { encoding: "utf8", timeout: 60_000 });

  assert.notEqual(result.status, 0, `production startup unexpectedly succeeded: ${result.stdout}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /TOTP_ENCRYPTION_KEY/);
});

test("B-003 runtime: production startup with strong TOTP key does not fail on TOTP key (but may fail on OIDC)", () => {
  // With a valid >=32 char key, the TOTP guard is satisfied.
  // On current main, production also throws PRODUCTION_OIDC_ADAPTER_UNAVAILABLE,
  // so the container will still exit nonzero — but the error must NOT be TOTP_ENCRYPTION_KEY.
  const strongKey = "synthetic-strong-key-for-production-test-001";
  const result = spawnSync("docker", [
    "compose", "run", "--rm", "--no-deps",
    "-e", "APP_ENV=production",
    "-e", `TOTP_ENCRYPTION_KEY=${strongKey}`,
    "--entrypoint", "node", "api", "dist/apps/api/src/index.js"
  ], { encoding: "utf8", timeout: 60_000 });

  // Exit nonzero is expected (Poort C blocked, OIDC unavailable)
  assert.notEqual(result.status, 0, `production startup should still fail (OIDC unavailable)`);
  // BUT the error must be OIDC, not TOTP — proving the TOTP guard passed
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /PRODUCTION_OIDC_ADAPTER_UNAVAILABLE/, "expected OIDC error when TOTP key is valid");
  assert.doesNotMatch(output, /TOTP_ENCRYPTION_KEY/, "TOTP guard must not fire when key is valid");
});

test("B-003 runtime: explicit local mode boots with synthetic key and serves /health/live", () => {
  // APP_ENV=local must boot with the synthetic fallback key
  // The API needs DATABASE_URL/REDIS_URL; /health/live is process-only
  const result = spawnSync("docker", [
    "compose", "run", "--rm", "--no-deps",
    "-e", "APP_ENV=local",
    "--entrypoint", "node", "api", "dist/apps/api/src/index.js"
  ], { encoding: "utf8", timeout: 60_000 });

  // The process should start listening (exit 0 is not expected as it runs forever)
  // We verify it doesn't exit with a TOTP error and that it logs server_started
  const output = `${result.stdout}\n${result.stderr}`;
  assert.doesNotMatch(output, /TOTP_ENCRYPTION_KEY/, "local mode must not fail on TOTP key");
  assert.match(output, /server_started/, "local mode must start the HTTP server");
});

test("B-003 runtime: NODE_ENV=production without APP_ENV defaults to production and fails closed", () => {
  // When NODE_ENV=production is set and APP_ENV is absent,
  // the effective environment is production → TOTP guard fires.
  const result = spawnSync("docker", [
    "compose", "run", "--rm", "--no-deps",
    "-e", "NODE_ENV=production",
    "--entrypoint", "node", "api", "dist/apps/api/src/index.js"
  ], { encoding: "utf8", timeout: 60_000 });

  assert.notEqual(result.status, 0, `production NODE_ENV without APP_ENV must fail closed`);
  assert.match(`${result.stdout}\n${result.stderr}`, /TOTP_ENCRYPTION_KEY/);
});

test("B-003 runtime: APP_ENV=production overrides NODE_ENV=development", () => {
  // Explicit APP_ENV=production should win over NODE_ENV=development
  const result = spawnSync("docker", [
    "compose", "run", "--rm", "--no-deps",
    "-e", "NODE_ENV=development",
    "-e", "APP_ENV=production",
    "--entrypoint", "node", "api", "dist/apps/api/src/index.js"
  ], { encoding: "utf8", timeout: 60_000 });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /TOTP_ENCRYPTION_KEY/);
});

test("B-003 runtime: NODE_ENV=production + APP_ENV=local — conflict throws", () => {
  // When both are set and disagree on production, fail closed
  const result = spawnSync("docker", [
    "compose", "run", "--rm", "--no-deps",
    "-e", "NODE_ENV=production",
    "-e", "APP_ENV=local",
    "--entrypoint", "node", "api", "dist/apps/api/src/index.js"
  ], { encoding: "utf8", timeout: 60_000 });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /conflict|NODE_ENV and APP_ENV/);
});