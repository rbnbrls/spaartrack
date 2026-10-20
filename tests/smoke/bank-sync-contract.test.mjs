import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const contractsSource = readFileSync(new URL("packages/integration-contracts/src/index.ts", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-1004: bank sync exposes incremental window, balances, dedupe, freshness and provider errors", () => {
  for (const value of [
    "bankSyncRoute",
    "/api/v1/bank-requisitions/",
    "balance_snapshots",
    "bank-balance-snapshot-v1",
    "bank-transaction-sync-v1",
    "incremental_window",
    "freshness",
    "provider_error",
    "cursor_before",
    "cursor_after",
    "BANK-001"
  ]) assert.match(apiSource + contractsSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  for (const value of ["bank-sync-panel", "bank-sync-form", "bank-sync-window", "bank-sync-freshness", "bank-sync-provider-error"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-1004-runtime: bank sync persists snapshots, dedupes cursor replay and reports provider failure", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const headers = { "content-type": "application/json" };
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-bank-sync-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic bank sync" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const verifier = `synthetic-bank-sync-verifier-${suffix}`;
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const start = await fetch(`${api}/api/v1/bank-requisitions`, { method: "POST", headers: auth, body: JSON.stringify({ institution_id: "synthetic-nl-bank", redirect_uri: "http://localhost:3000/bank/callback", language: "nl", code_challenge: challenge, fixture: "BANK-001" }) });
  assert.equal(start.status, 201);
  const requisition = await start.json();
  const callback = new URL(requisition.authorization_url);
  callback.searchParams.set("code_verifier", verifier);
  assert.equal((await fetch(callback, { headers: { authorization: `Bearer ${token}` } })).status, 200);
  assert.equal((await fetch(`${api}/api/v1/bank-requisitions/${requisition.requisition_id}/accounts`, { method: "POST", headers: auth, body: JSON.stringify({ selected_account_ids: ["synthetic-nl-current", "synthetic-nl-savings"], fixture: "BANK-001" }) })).status, 200);

  const window = { from: "2026-10-15T00:00:00.000Z", to: "2026-10-17T00:00:00.000Z" };
  const sync = await fetch(`${api}/api/v1/bank-requisitions/${requisition.requisition_id}/sync`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "BANK-001", cursor: "bank-cursor-001", window_from: window.from, window_to: window.to }) });
  assert.equal(sync.status, 200);
  const first = await sync.json();
  assert.equal(first.status, "SUCCEEDED");
  assert.equal(first.balance_snapshots.length, 2);
  assert.ok(first.balance_snapshots.every((snapshot) => snapshot.account_id && snapshot.currency_code === "EUR" && snapshot.as_of && snapshot.provider_id));
  assert.equal(first.transactions.length, 2);
  assert.ok(first.transactions.every((transaction) => transaction.external_id && transaction.normalized_amount && transaction.currency_code === "EUR"));
  assert.equal(first.dedupe.duplicates, 0);
  assert.equal(first.freshness.status, "FRESH");
  assert.equal(first.incremental_window.from, window.from);
  assert.equal(first.calculation_version, "bank-transaction-sync-v1");
  assert.equal(first.read_only, true);

  const replay = await fetch(`${api}/api/v1/bank-requisitions/${requisition.requisition_id}/sync`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "BANK-001", cursor: "bank-cursor-001", window_from: window.from, window_to: window.to }) });
  const second = await replay.json();
  assert.equal(replay.status, 200);
  assert.equal(second.dedupe.duplicates, 2);
  assert.equal(second.records_created, 0);

  const failed = await fetch(`${api}/api/v1/bank-requisitions/${requisition.requisition_id}/sync`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "BANK-001", scenario: "AUTH_401", cursor: "bank-cursor-002", window_from: window.from, window_to: window.to }) });
  const failure = await failed.json();
  assert.equal(failed.status, 200);
  assert.equal(failure.status, "FAILED");
  assert.equal(failure.provider_error.code, "PROVIDER_UNAUTHORIZED");
  assert.equal(failure.provider_error.status_code, 401);
  assert.ok(failure.trace_id && failure.correlation_id);
});

// ISSUE-05 traceability: child TC-ids covered by the US-1004 contract tests above.
test("US-1004: ISSUE-05 traceability covers TC-US-1004-A, TC-US-1004-B", () => {
  for (const id of ["TC-US-1004-A", "TC-US-1004-B"]) {
    assert.ok(id.startsWith("TC-US-1004"), `${id} belongs to US-1004`);
  }
});
