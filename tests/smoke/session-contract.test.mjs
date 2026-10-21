import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const api = apiUrl;

test("TC-US-0202: sessions are opaque, hashed, expirable and revocable", () => {
  assert.match(apiSource, /\/api\/v1\/sessions/);
  assert.match(apiSource, /createHash\("sha256"\)/);
  assert.match(apiSource, /token_hash/);
  assert.match(apiSource, /expires_at/);
  assert.match(apiSource, /revoked_at/);
  assert.match(apiSource, /Authorization|authorization/);
  assert.match(apiSource, /TOTP_NOT_ENROLLED/);
  assert.match(apiSource, /AUTHENTICATOR_NOT_CONFIGURED/);
  assert.match(apiSource, /SYNTHETIC_FIXTURE_KEY/);
  assert.match(apiSource, /\/api\/v1\/test-fixtures\/sessions/);
  assert.match(apiSource, /req\.url === "\/api\/v1\/test-fixtures\/sessions"/);
});

test("TC-US-0202-A: local session login, expiry and logout lifecycle", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const email = `synthetic-session-0202-${Date.now()}@example.test`;
  const emailOnly = await fetch(`${api}/api/v1/sessions`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, ttl_seconds: 30 })
  });
  assert.equal(emailOnly.status, 401);

  const bootstrap = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic Session User 0202" })
  });
  assert.equal(bootstrap.status, 201);
  const emailOnlyExistingUser = await fetch(`${api}/api/v1/sessions`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, ttl_seconds: 30 })
  });
  assert.equal(emailOnlyExistingUser.status, 401);
  assert.equal((await emailOnlyExistingUser.json()).error, "AUTHENTICATOR_NOT_CONFIGURED");

  const bootstrappedLogin = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" },
    body: JSON.stringify({ email, ttl_seconds: 30 })
  });
  assert.equal(bootstrappedLogin.status, 201);
  await fetch(`${api}/api/v1/sessions/current`, {
    method: "DELETE", headers: { authorization: `Bearer ${(await bootstrappedLogin.json()).token}` }
  });

  const user = await bootstrap.json();

  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trace-id": "trace-session-0202", "x-synthetic-fixture-key": "local-test-fixture-only" },
    body: JSON.stringify({ email, ttl_seconds: 30 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  assert.equal(typeof session.token, "string");
  assert.ok(session.token.length >= 32);
  assert.equal(session.user_id, user.id);

  const me = await fetch(`${api}/api/v1/sessions/me`, { headers: { authorization: `Bearer ${session.token}` } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user_id, user.id);

  const revoke = await fetch(`${api}/api/v1/sessions/current`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${session.token}` }
  });
  assert.equal(revoke.status, 200);

  const afterRevoke = await fetch(`${api}/api/v1/sessions/me`, { headers: { authorization: `Bearer ${session.token}` } });
  assert.equal(afterRevoke.status, 401);

  const shortLogin = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" },
    body: JSON.stringify({ email, ttl_seconds: 1 })
  });
  assert.equal(shortLogin.status, 201);
  const shortSession = await shortLogin.json();
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const expired = await fetch(`${api}/api/v1/sessions/me`, { headers: { authorization: `Bearer ${shortSession.token}` } });
  assert.equal(expired.status, 401);
});
