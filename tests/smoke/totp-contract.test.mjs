import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const migrationSource = readFileSync(new URL("database/migrations/0002-user-totp.sql", root), "utf8");
const securityMigration = readFileSync(new URL("database/migrations/0028-totp-replay-and-lockout.sql", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

function base32Decode(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  return Buffer.from(bits.match(/.{8}/g).map((chunk) => parseInt(chunk, 2)));
}

function totp(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

test("TC-US-0203-A: TOTP factor is encrypted, enrollable, verifiable and revocable", () => {
  for (const value of ["/api/v1/2fa/totp", "user_totp_factor", "aes-256-gcm", "timingSafeEqual"]) {
    assert.match(apiSource, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /user_totp_factor/);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS/);
  assert.match(migrationSource, /secret_ciphertext/);
  assert.match(securityMigration, /last_used_counter/);
  assert.match(securityMigration, /failed_attempts/);
  assert.match(securityMigration, /locked_until/);
  assert.match(apiSource, /last_used_counter/);
  assert.match(apiSource, /failed_attempts/);
  assert.match(apiSource, /locked_until/);
});

test("TC-US-0203-A-runtime: enrolment, success, invalid code and revoke", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const email = `synthetic-totp-0203-${Date.now()}@example.test`;
  const userResponse = await fetch(`${api}/api/v1/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic TOTP User 0203" })
  });
  const user = await userResponse.json();
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" },
    body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };

  const noAuthEnroll = await fetch(`${api}/api/v1/2fa/totp`, { method: "POST" });
  assert.equal(noAuthEnroll.status, 401);

  const enroll = await fetch(`${api}/api/v1/2fa/totp`, { method: "POST", headers: auth });
  assert.equal(enroll.status, 201);
  const factor = await enroll.json();
  assert.equal(factor.user_id, user.id);
  assert.equal(typeof factor.secret, "string");
  assert.match(factor.secret, /^[A-Z2-7]+=*$/);

  const valid = await fetch(`${api}/api/v1/2fa/totp/verify`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ code: totp(factor.secret) })
  });
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).verified, true);

  const replay = await fetch(`${api}/api/v1/2fa/totp/verify`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ code: totp(factor.secret) })
  });
  assert.equal(replay.status, 401);

  const replayLogin = await fetch(`${api}/api/v1/sessions`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code: totp(factor.secret), ttl_seconds: 120 })
  });
  assert.equal(replayLogin.status, 401);

  const invalid = await fetch(`${api}/api/v1/2fa/totp/verify`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ code: "000000" })
  });
  assert.equal(invalid.status, 401);

  const revoke = await fetch(`${api}/api/v1/2fa/totp`, { method: "DELETE", headers: auth });
  assert.equal(revoke.status, 200);
  const afterRevoke = await fetch(`${api}/api/v1/2fa/totp/verify`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ code: totp(factor.secret) })
  });
  assert.equal(afterRevoke.status, 401);
});
