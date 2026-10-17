import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const contractsSource = readFileSync(new URL("packages/integration-contracts/src/index.ts", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-1007: expired bank consent preserves history and requires reconnect", () => {
  for (const value of ["bankRequisitionExpiryRoute", "EXPIRED", "reconnect_required", "historical_data_preserved", "bank-reconnect-v1", "cross_connection_external_id", "no_double_counting"]) {
    assert.match(apiSource + contractsSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["bank-consent-expire", "bank-consent-reconnect", "bank-reconnect-status", "historical data preserved", "reconnect required"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-1007-runtime: expiry keeps historical sync and reconnect dedupes previous provider transaction", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const headers = { "content-type": "application/json" };
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-bank-reconnect-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic bank reconnect" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/sessions`, { method: "POST", headers, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const startRequisition = async (label) => {
    const verifier = `synthetic-reconnect-${label}-${suffix}`;
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const start = await fetch(`${api}/api/v1/bank-requisitions`, { method: "POST", headers: auth, body: JSON.stringify({ institution_id: "synthetic-nl-bank", redirect_uri: "http://localhost:3000/bank/callback", language: "nl", code_challenge: challenge, fixture: "BANK-001" }) });
    assert.equal(start.status, 201);
    const requisition = await start.json();
    const callback = new URL(requisition.authorization_url);
    callback.searchParams.set("code_verifier", verifier);
    assert.equal((await fetch(callback, { headers: { authorization: `Bearer ${token}` } })).status, 200);
    assert.equal((await fetch(`${api}/api/v1/bank-requisitions/${requisition.requisition_id}/accounts`, { method: "POST", headers: auth, body: JSON.stringify({ selected_account_ids: ["synthetic-nl-current"], fixture: "BANK-001" }) })).status, 200);
    return requisition;
  };
  const first = await startRequisition("first");
  const window = { from: "2026-10-15T00:00:00.000Z", to: "2026-10-17T23:59:59.000Z" };
  const initialSync = await fetch(`${api}/api/v1/bank-requisitions/${first.requisition_id}/sync`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "BANK-001", cursor: "reconnect-cursor-001", ...{ window_from: window.from, window_to: window.to } }) });
  assert.equal(initialSync.status, 200);
  assert.equal((await initialSync.json()).records_created, 1);
  const expire = await fetch(`${api}/api/v1/bank-requisitions/${first.requisition_id}/expire`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "BANK-001" }) });
  assert.equal(expire.status, 200);
  const expired = await expire.json();
  assert.equal(expired.status, "EXPIRED");
  assert.equal(expired.historical_data_preserved, true);
  assert.equal(expired.reconnect_required, true);
  const status = await fetch(`${api}/api/v1/bank-requisitions/${first.requisition_id}/status`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).status, "EXPIRED");

  const second = await startRequisition("second");
  assert.notEqual(second.requisition_id, first.requisition_id);
  const reconnectSync = await fetch(`${api}/api/v1/bank-requisitions/${second.requisition_id}/sync`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "BANK-001", cursor: "reconnect-cursor-001", window_from: window.from, window_to: window.to }) });
  assert.equal(reconnectSync.status, 200);
  const replay = await reconnectSync.json();
  assert.equal(replay.records_created, 0);
  assert.equal(replay.dedupe.duplicates, 1);
  assert.equal(replay.dedupe.strategy, "cross_connection_external_id");
  assert.equal(replay.no_double_counting, true);
});
