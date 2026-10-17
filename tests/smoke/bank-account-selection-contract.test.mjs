import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const contractsSource = readFileSync(new URL("packages/integration-contracts/src/index.ts", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-1003: authorized bank account selection exposes only selected accounts with type and currency", () => {
  for (const value of [
    "/api/v1/bank-requisitions/",
    "bankAccountSelectionRoute",
    "provider_account",
    "account_type",
    "base_currency_code",
    "selected_account_ids",
    "bank-account-selection-v1",
    "BANK-001"
  ]) {
    assert.match(apiSource + contractsSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["bank-accounts-panel", "bank-accounts-form", "bank-account-selection", "bank-account-type", "bank-account-currency"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-1003-runtime: selection persists only chosen synthetic accounts and rejects unknown IDs", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const headers = { "content-type": "application/json" };
  const email = `synthetic-bank-1003-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic account selector" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/sessions`, { method: "POST", headers, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const verifier = `synthetic-verifier-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const start = await fetch(`${api}/api/v1/bank-requisitions`, { method: "POST", headers: auth, body: JSON.stringify({ institution_id: "synthetic-nl-bank", redirect_uri: "http://localhost:3000/bank/callback", language: "nl", code_challenge: challenge, fixture: "BANK-001" }) });
  assert.equal(start.status, 201);
  const requisition = await start.json();
  const callback = new URL(requisition.authorization_url);
  callback.searchParams.set("code_verifier", verifier);
  assert.equal((await fetch(callback, { headers: { authorization: `Bearer ${token}` } })).status, 200);
  const available = await fetch(`${api}/api/v1/bank-requisitions/${requisition.requisition_id}/accounts`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(available.status, 200);
  const availableBody = await available.json();
  assert.equal(availableBody.calculation_version, "bank-account-selection-v1");
  assert.equal(availableBody.accounts.length, 3);
  assert.ok(availableBody.accounts.every((account) => account.selected === false));
  const selection = await fetch(`${api}/api/v1/bank-requisitions/${requisition.requisition_id}/accounts`, { method: "POST", headers: auth, body: JSON.stringify({ selected_account_ids: ["synthetic-nl-current", "synthetic-nl-savings"], fixture: "BANK-001" }) });
  assert.equal(selection.status, 200);
  const selected = await selection.json();
  assert.equal(selected.selected_account_ids.length, 2);
  assert.deepEqual(selected.accounts.map((account) => [account.id, account.account_type, account.base_currency_code]), [["synthetic-nl-current", "CURRENT", "EUR"], ["synthetic-nl-savings", "SAVINGS", "EUR"]]);
  const reread = await (await fetch(`${api}/api/v1/bank-requisitions/${requisition.requisition_id}/accounts`, { headers: { authorization: `Bearer ${token}` } })).json();
  assert.deepEqual(reread.accounts.filter((account) => account.selected).map((account) => account.id), ["synthetic-nl-current", "synthetic-nl-savings"]);
  const invalid = await fetch(`${api}/api/v1/bank-requisitions/${requisition.requisition_id}/accounts`, { method: "POST", headers: auth, body: JSON.stringify({ selected_account_ids: ["not-from-bank-001"], fixture: "BANK-001" }) });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error, "INVALID_BANK_ACCOUNT_SELECTION");
});
