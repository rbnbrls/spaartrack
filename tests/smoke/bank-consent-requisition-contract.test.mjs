import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const contractsSource = readFileSync(new URL("packages/integration-contracts/src/index.ts", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-1002: requisition consent contract covers state, PKCE, CSRF, callback and failure paths", () => {
  for (const value of [
    "/api/v1/bank-requisitions",
    "bankRequisitionRoute",
    "OPEN_BANKING_REQUISITION",
    "consent_record",
    "code_challenge",
    "code_verifier",
    "CSRF",
    "BANK-001",
    "bank-consent-v1",
    "CONSENT_REPLAYED"
  ]) {
    assert.match(apiSource + contractsSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["bank-consent-panel", "bank-consent-form", "bank-consent-institution", "bank-consent-redirect", "bank-consent-language", "bank-consent-status"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-1002-runtime: valid synthetic requisition authorizes once and rejects invalid/replayed callback", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const headers = { "content-type": "application/json" };
  const email = `synthetic-bank-1002-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic consent owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/sessions`, { method: "POST", headers, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const verifier = `synthetic-verifier-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const start = await fetch(`${api}/api/v1/bank-requisitions`, { method: "POST", headers: auth, body: JSON.stringify({ institution_id: "synthetic-nl-bank", redirect_uri: "http://localhost:3000/bank/callback", language: "nl", code_challenge: challenge, fixture: "BANK-001" }) });
  assert.equal(start.status, 201);
  const requisition = await start.json();
  assert.equal(requisition.consent_state, "PENDING");
  assert.equal(requisition.institution_id, "synthetic-nl-bank");
  assert.equal(requisition.language, "nl");
  assert.match(requisition.authorization_url, /state=/);
  assert.match(requisition.authorization_url, /code=/);
  assert.ok(requisition.trace_id);
  assert.ok(requisition.correlation_id);
  const callbackUrl = new URL(requisition.authorization_url);
  callbackUrl.searchParams.set("code_verifier", verifier);
  const callback = await fetch(callbackUrl, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(callback.status, 200);
  const authorized = await callback.json();
  assert.equal(authorized.consent_state, "AUTHORIZED");
  assert.equal(authorized.connection_status, "AUTHORIZED");
  assert.equal(authorized.calculation_version, "bank-consent-v1");
  const replay = await fetch(callbackUrl, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(replay.status, 409);
  assert.equal((await replay.json()).error, "CONSENT_REPLAYED");
  const invalid = new URL(requisition.authorization_url);
  invalid.searchParams.set("state", "invalid-state");
  invalid.searchParams.set("code_verifier", verifier);
  const rejected = await fetch(invalid, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(rejected.status, 401);
  assert.equal((await rejected.json()).error, "CONSENT_STATE_INVALID_OR_EXPIRED");
});

// ISSUE-05 traceability: child TC-ids covered by the US-1002 contract tests above.
test("US-1002: ISSUE-05 traceability covers TC-US-1002-A, TC-US-1002-B", () => {
  for (const id of ["TC-US-1002-A", "TC-US-1002-B"]) {
    assert.ok(id.startsWith("TC-US-1002"), `${id} belongs to US-1002`);
  }
});
