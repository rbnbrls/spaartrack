import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0202: sessions are opaque, hashed, expirable and revocable", () => {
  assert.match(apiSource, /\/api\/v1\/sessions/);
  assert.match(apiSource, /createHash\("sha256"\)/);
  assert.match(apiSource, /token_hash/);
  assert.match(apiSource, /expires_at/);
  assert.match(apiSource, /revoked_at/);
  assert.match(apiSource, /Authorization|authorization/);
});

test("TC-US-0202-A: local session login, expiry and logout lifecycle", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const email = `synthetic-session-0202-${Date.now()}@example.test`;
  const userResponse = await fetch(`${api}/api/v1/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic Session User 0202" })
  });
  assert.equal(userResponse.status, 201);
  const user = await userResponse.json();

  const login = await fetch(`${api}/api/v1/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trace-id": "trace-session-0202" },
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

  const shortLogin = await fetch(`${api}/api/v1/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, ttl_seconds: 1 })
  });
  assert.equal(shortLogin.status, 201);
  const shortSession = await shortLogin.json();
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const expired = await fetch(`${api}/api/v1/sessions/me`, { headers: { authorization: `Bearer ${shortSession.token}` } });
  assert.equal(expired.status, 401);
});
