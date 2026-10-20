import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const composeSource = readFileSync(new URL("compose.yaml", root), "utf8");
const migrationSource = readFileSync(new URL("database/migrations/0028-totp-replay-and-lockout.sql", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

function base32Decode(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  return Buffer.from((bits.match(/.{8}/g) || []).map((chunk) => parseInt(chunk, 2)));
}

function totp(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

const jsonHeaders = { "content-type": "application/json" };
const bearer = (token) => ({ authorization: `Bearer ${token}` });

async function createUser(label) {
  const email = `synthetic-auth-boundary-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const response = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: jsonHeaders,
    body: JSON.stringify({ email, display_name: `Synthetic ${label}` })
  });
  assert.equal(response.status, 201);
  return { ...(await response.json()), email };
}

async function issueSyntheticLocalSession(email) {
  const response = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: { ...jsonHeaders, "x-synthetic-fixture-key": "local-test-fixture-only" },
    body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(response.status, 201);
  return (await response.json()).token;
}

test("B-003 contract: user auth scope, TOTP login replay/attempt limits, and production auth fail closed", () => {
  assert.match(apiSource, /requireSelfUser/);
  assert.match(apiSource, /USER_SCOPE_FORBIDDEN/);
  assert.match(apiSource, /PRODUCTION_OIDC_ADAPTER_UNAVAILABLE/);
  assert.match(apiSource, /last_used_counter/);
  assert.match(apiSource, /failed_attempts/);
  assert.match(apiSource, /locked_until/);
  assert.match(apiSource, /APP_AUTH_MODE/);
  assert.match(apiSource, /SYNTHETIC_FIXTURE_KEY/);
  assert.match(apiSource, /AUTHENTICATOR_NOT_CONFIGURED/);
  assert.match(apiSource, /synthetic-oidc/);
  assert.match(apiSource, /environment === "production"/);
  assert.match(apiSource, /PRODUCTION_OIDC_ADAPTER_UNAVAILABLE/);
  assert.match(composeSource, /APP_AUTH_MODE/);
  assert.match(composeSource, /APP_AUTH_MODE: \$\{APP_AUTH_MODE:-synthetic\}/);
  assert.match(readFileSync(new URL(".env.example", root), "utf8"), /APP_AUTH_MODE=synthetic/);
  assert.match(migrationSource, /last_used_counter/);
  assert.match(migrationSource, /failed_attempts/);
  assert.match(migrationSource, /locked_until/);
});

test("TC-US-0203-OIDC-DEPLOY: production startup: self-asserted provider validation is insufficient without an OIDC adapter", { skip: process.env.STACK_SMOKE !== "1" }, () => {
  const result = spawnSync("docker", [
    "compose", "run", "--rm", "--no-deps",
    "-e", "APP_ENV=production",
    "-e", "APP_AUTH_MODE=oidc",
    "-e", "OIDC_ISSUER=https://issuer.example.test",
    "-e", "OIDC_CLIENT_ID=synthetic-client",
    "-e", "OIDC_CLIENT_SECRET_REF=synthetic/test-reference",
    "-e", "OIDC_PROVIDER_VALIDATED=true",
    "--entrypoint", "node", "api", "dist/index.js"
  ], { encoding: "utf8", timeout: 60_000 });
  assert.notEqual(result.status, 0, `production startup unexpectedly succeeded: ${result.stdout}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /PRODUCTION_OIDC_ADAPTER_UNAVAILABLE/);
});

test("TC-US-0201-AUTH: runtime: user reads and lifecycle reject missing and outsider identity", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const owner = await createUser("owner");
  const outsider = await createUser("outsider");
  const unauthenticatedFixtureSession = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: jsonHeaders,
    body: JSON.stringify({ email: owner.email, ttl_seconds: 120 })
  });
  assert.equal(unauthenticatedFixtureSession.status, 401);
  assert.equal((await unauthenticatedFixtureSession.json()).error, "SYNTHETIC_FIXTURE_AUTH_REQUIRED");

  const ownerToken = await issueSyntheticLocalSession(owner.email);
  const outsiderToken = await issueSyntheticLocalSession(outsider.email);

  const noAuthRead = await fetch(`${api}/api/v1/users/${owner.id}`);
  assert.equal(noAuthRead.status, 401);
  const outsiderRead = await fetch(`${api}/api/v1/users/${owner.id}`, { headers: bearer(outsiderToken) });
  assert.equal(outsiderRead.status, 403);
  const selfRead = await fetch(`${api}/api/v1/users/${owner.id}`, { headers: bearer(ownerToken) });
  assert.equal(selfRead.status, 200);

  const noAuthStatus = await fetch(`${api}/api/v1/users/${owner.id}/status`, {
    method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ status: "SUSPENDED" })
  });
  assert.equal(noAuthStatus.status, 401);
  const outsiderStatus = await fetch(`${api}/api/v1/users/${owner.id}/status`, {
    method: "PATCH", headers: { ...jsonHeaders, ...bearer(outsiderToken) }, body: JSON.stringify({ status: "SUSPENDED" })
  });
  assert.equal(outsiderStatus.status, 403);
});

test("TC-US-0203-C: runtime: TOTP protects sessions after enrollment and an accepted code cannot be replayed", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const user = await createUser("totp-login");
  const bootstrapToken = await issueSyntheticLocalSession(user.email);
  const enrollment = await fetch(`${api}/api/v1/2fa/totp`, { method: "POST", headers: bearer(bootstrapToken) });
  assert.equal(enrollment.status, 201);
  const factor = await enrollment.json();

  const emailOnly = await fetch(`${api}/api/v1/sessions`, {
    method: "POST", headers: jsonHeaders,
    body: JSON.stringify({ email: user.email, ttl_seconds: 120 })
  });
  assert.equal(emailOnly.status, 401);
  assert.equal((await emailOnly.json()).token, undefined);

  const code = totp(factor.secret);
  const login = await fetch(`${api}/api/v1/sessions`, {
    method: "POST", headers: jsonHeaders,
    body: JSON.stringify({ email: user.email, code, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  assert.equal((await login.json()).user_id, user.id);

  const replayLogin = await fetch(`${api}/api/v1/sessions`, {
    method: "POST", headers: jsonHeaders,
    body: JSON.stringify({ email: user.email, code, ttl_seconds: 120 })
  });
  assert.equal(replayLogin.status, 401);

  const replayVerify = await fetch(`${api}/api/v1/2fa/totp/verify`, {
    method: "POST", headers: { ...jsonHeaders, ...bearer(bootstrapToken) }, body: JSON.stringify({ code })
  });
  assert.equal(replayVerify.status, 401);
});

test("B-003 runtime: repeated invalid TOTP attempts lock verification", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const user = await createUser("totp-lockout");
  const bootstrapToken = await issueSyntheticLocalSession(user.email);
  const enrollment = await fetch(`${api}/api/v1/2fa/totp`, { method: "POST", headers: bearer(bootstrapToken) });
  assert.equal(enrollment.status, 201);
  const factor = await enrollment.json();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invalid = await fetch(`${api}/api/v1/2fa/totp/verify`, {
      method: "POST", headers: { ...jsonHeaders, ...bearer(bootstrapToken) }, body: JSON.stringify({ code: "000000" })
    });
    assert.equal(invalid.status, attempt < 4 ? 401 : 429);
  }
  const correctWhileLocked = await fetch(`${api}/api/v1/2fa/totp/verify`, {
    method: "POST", headers: { ...jsonHeaders, ...bearer(bootstrapToken) }, body: JSON.stringify({ code: totp(factor.secret) })
  });
  assert.equal(correctWhileLocked.status, 429);
});
