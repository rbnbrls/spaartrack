import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = apiUrl;

test("TC-US-0605: duplicate detection exposes provider id/hash reasons without ledger writes", () => {
  for (const value of [
    "/api/v1/import-validations", "DUPLICATE", "provider_id", "provider_hash",
    "IMPORT_DUPLICATE_PROVIDER_ID", "IMPORT_DUPLICATE_PROVIDER_HASH", "rows_duplicate",
    "ledger_transaction", "external_id", "external_hash", "idempotent"
  ]) assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const value of ["duplicate", "duplicate-reason", "DUPLICATE"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-0605-runtime: provider id/hash matches are previewed and do not double-book", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const jsonHeaders = { "content-type": "application/json" };
  const email = `synthetic-import-duplicate-0605-${suffix}@example.test`;
  const user = await fetch(`${api}/api/v1/users`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email, display_name: "Synthetic duplicate reviewer" }) });
  assert.equal(user.status, 201);
  const session = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...jsonHeaders, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(session.status, 201);
  const token = (await session.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...jsonHeaders };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Duplicate ${suffix}`, reporting_currency_code: "EUR", privacy_scope: "PRIVATE" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic duplicate account", account_type: "BROKERAGE", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();
  const providerId = `provider-deposit-${suffix}`;
  const created = await fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: "DEPOSIT", occurred_at: "2026-10-17T10:00:00.000Z", effective_date: "2026-10-17", amount: "12.34", currency_code: "EUR", source_type: "IMPORT", external_id: providerId }) });
  assert.equal(created.status, 201);
  const original = await created.json();
  const providerHash = createHash("sha256").update(JSON.stringify([account.id, null, "DEPOSIT", "2026-10-17T10:00:00.000Z", "2026-10-17", "12.34", "EUR", "IMPORT", null, null, null, "0", "0"])).digest("hex");
  const csv = [
    "date,action,amount,currency,provider_id,provider_hash",
    `2026-10-17,DEPOSIT,12.34,EUR,${providerId},`,
    `2026-10-17,DEPOSIT,12.34,EUR,,${providerHash}`
  ].join("\n") + "\n";
  const preview = await fetch(`${api}/api/v1/import-validations`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, filename: `IMPORT-001-duplicate-${suffix}.csv`, content_type: "text/csv", content_base64: Buffer.from(csv).toString("base64") }) });
  assert.equal(preview.status, 201);
  const result = await preview.json();
  assert.equal(result.counts.rows_duplicate, 2);
  assert.equal(result.rows[0].status, "DUPLICATE");
  assert.ok(result.rows[0].error_codes.includes("IMPORT_DUPLICATE_PROVIDER_ID"));
  assert.equal(result.rows[1].status, "DUPLICATE");
  assert.ok(result.rows[1].error_codes.includes("IMPORT_DUPLICATE_PROVIDER_HASH"));
  assert.equal(result.rows[0].duplicate_reason, "provider_id");
  assert.equal(result.rows[1].duplicate_reason, "provider_hash");
  const read = await fetch(`${api}/api/v1/ledger/transactions/${original.id}`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(read.status, 200);
  assert.equal((await read.json()).id, original.id);
});
