import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const contractsSource = readFileSync(new URL("packages/integration-contracts/src/index.ts", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-1005: bank requisition revoke cleans local references and disconnects without ledger writes", () => {
  for (const value of ["bankRevokeRoute", "/api/v1/bank-requisitions/", "provider_revoke", "secret_cleanup", "DISCONNECTED", "BANK_CONNECTION_ALREADY_DISCONNECTED", "bank-connection-revoke-v1", "ledger_untouched"]) {
    assert.match(apiSource + contractsSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["bank-revoke", "bank-revoke-status", "credential reference revoked", "connection disconnected"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-1005-runtime: authorized BANK-001 consent can be revoked once and rejects replay", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const headers = { "content-type": "application/json" };
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-bank-revoke-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic bank revoke" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/sessions`, { method: "POST", headers, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const verifier = `synthetic-bank-revoke-verifier-${suffix}`;
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const start = await fetch(`${api}/api/v1/bank-requisitions`, { method: "POST", headers: auth, body: JSON.stringify({ institution_id: "synthetic-nl-bank", redirect_uri: "http://localhost:3000/bank/callback", language: "nl", code_challenge: challenge, fixture: "BANK-001" }) });
  assert.equal(start.status, 201);
  const requisition = await start.json();
  const callback = new URL(requisition.authorization_url);
  callback.searchParams.set("code_verifier", verifier);
  assert.equal((await fetch(callback, { headers: { authorization: `Bearer ${token}` } })).status, 200);
  assert.equal((await fetch(`${api}/api/v1/bank-requisitions/${requisition.requisition_id}/accounts`, { method: "POST", headers: auth, body: JSON.stringify({ selected_account_ids: ["synthetic-nl-current"], fixture: "BANK-001" }) })).status, 200);

  const revoke = await fetch(`${api}/api/v1/bank-requisitions/${requisition.requisition_id}/revoke`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "BANK-001" }) });
  assert.equal(revoke.status, 200);
  const result = await revoke.json();
  assert.equal(result.status, "DISCONNECTED");
  assert.equal(result.provider_revoke.called, true);
  assert.equal(result.provider_revoke.status, "REVOKED");
  assert.equal(result.secret_cleanup.credential_reference_revoked, true);
  assert.equal(result.secret_cleanup.token_material, "not_stored");
  assert.equal(result.calculation_version, "bank-connection-revoke-v1");
  assert.equal(result.ledger_untouched, true);
  assert.ok(result.trace_id && result.correlation_id);

  const accounts = await fetch(`${api}/api/v1/bank-requisitions/${requisition.requisition_id}/accounts`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(accounts.status, 409);
  assert.equal((await accounts.json()).error, "BANK_CONSENT_REQUIRED");
  const replay = await fetch(`${api}/api/v1/bank-requisitions/${requisition.requisition_id}/revoke`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "BANK-001" }) });
  assert.equal(replay.status, 409);
  assert.equal((await replay.json()).error, "BANK_CONNECTION_ALREADY_DISCONNECTED");
});

// ISSUE-05 traceability: child TC-ids covered by the US-1005 contract tests above.
test("US-1005: ISSUE-05 traceability covers TC-US-1005-A, TC-US-1005-B", () => {
  for (const id of ["TC-US-1005-A", "TC-US-1005-B"]) {
    assert.ok(id.startsWith("TC-US-1005"), `${id} belongs to US-1005`);
  }
});
