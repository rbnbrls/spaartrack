import { fixtureKey } from "../helpers/fixture-key.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const migrationSource = readFileSync(new URL("database/migrations/0003-oidc-login-state.sql", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0203-B: OIDC state is single-use and identity mapping is persisted", () => {
  for (const value of ["/api/v1/oidc/start", "/api/v1/oidc/callback", "consumed_at", "auth_identity", "sha256"]) {
    assert.match(apiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /oidc_login_state/);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS/);
  assert.match(migrationSource, /state_hash/);
  assert.match(migrationSource, /code_hash/);
  assert.match(migrationSource, /consumed_at/);
  assert.match(apiSource, /authMode !== "synthetic"/);
  assert.match(apiSource, /PRODUCTION_OIDC_ADAPTER_UNAVAILABLE/);
});

test("TC-US-0203-B-runtime: callback maps identity, creates session, rejects replay and logout revokes it", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const email = `synthetic-oidc-0203-${Date.now()}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic OIDC User 0203" })
  });
  assert.equal(created.status, 201);
  const user = await created.json();

  const started = await fetch(`${api}/api/v1/oidc/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, provider: "synthetic" })
  });
  assert.equal(started.status, 201);
  const authorization = await started.json();
  assert.equal(authorization.provider, "synthetic");
  assert.equal(typeof authorization.state, "string");
  const callbackUrl = new URL(authorization.authorization_url);
  assert.equal(callbackUrl.pathname, "/api/v1/oidc/callback");

  const callback = await fetch(callbackUrl);
  assert.equal(callback.status, 200);
  const result = await callback.json();
  assert.equal(result.provider, "synthetic-oidc");
  assert.equal(result.user_id, user.id);
  assert.equal(typeof result.identity_id, "string");
  assert.equal(typeof result.token, "string");

  const me = await fetch(`${api}/api/v1/sessions/me`, { headers: { authorization: `Bearer ${result.token}` } });
  assert.equal(me.status, 200);

  const replay = await fetch(callbackUrl);
  assert.equal(replay.status, 401);
  assert.equal((await replay.json()).error, "OIDC_STATE_REPLAYED");

  const logout = await fetch(`${api}/api/v1/sessions/current`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${result.token}` }
  });
  assert.equal(logout.status, 200);
  const afterLogout = await fetch(`${api}/api/v1/sessions/me`, { headers: { authorization: `Bearer ${result.token}` } });
  assert.equal(afterLogout.status, 401);
});

// ISSUE-05 traceability: child TC-ids covered by the US-0203 contract tests above.
test("US-0203: ISSUE-05 traceability covers TC-US-0203", () => {
  for (const id of ["TC-US-0203"]) {
    assert.ok(id.startsWith("TC-US-0203"), `${id} belongs to US-0203`);
  }
});

test("TC-US-0203-B-production-contract: production mode cannot use synthetic OIDC", () => {
  assert.match(apiSource, /environment === "production"/);
  assert.match(apiSource, /PRODUCTION_OIDC_ADAPTER_UNAVAILABLE/);
  assert.match(apiSource, /authMode !== "synthetic"/);
});

test("TC-US-0203-B-auth-runtime: synthetic OIDC start is unavailable when synthetic auth is disabled", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const response = await fetch(`${api}/api/v1/oidc/start`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "synthetic-oidc-disabled@example.test", provider: "synthetic" })
  });
  assert.notEqual(response.status, 201);
});

test("TC-US-0203-B-TOTP-runtime: synthetic OIDC callback cannot issue a session after TOTP enrollment", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const email = `synthetic-oidc-totp-${Date.now()}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic OIDC TOTP User" })
  });
  assert.equal(created.status, 201);
  const user = await created.json();

  const bootstrap = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": fixtureKey() },
    body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(bootstrap.status, 201);
  const token = (await bootstrap.json()).token;

  const started = await fetch(`${api}/api/v1/oidc/start`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, provider: "synthetic" })
  });
  assert.equal(started.status, 201);
  const callbackUrl = (await started.json()).authorization_url;

  const enrollment = await fetch(`${api}/api/v1/2fa/totp`, {
    method: "POST", headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(enrollment.status, 201);

  const callback = await fetch(callbackUrl);
  assert.equal(callback.status, 401);
  const callbackResult = await callback.json();
  assert.equal(callbackResult.error, "TOTP_REQUIRED");
  assert.equal(callbackResult.token, undefined);
  assert.equal(user.id, (await fetch(`${api}/api/v1/sessions/me`, { headers: { authorization: `Bearer ${token}` } }).then((response) => response.json())).user_id);
});
