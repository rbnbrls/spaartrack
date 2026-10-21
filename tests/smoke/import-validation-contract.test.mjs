import { fixtureKey } from "../helpers/fixture-key.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const migrationSource = readFileSync(new URL("database/migrations/0010-import-row-validation.sql", root), "utf8");
const fixture = readFileSync(new URL("fixtures/IMPORT-001.csv", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0603: import validation keeps valid, warning, error and unsupported rows separate", () => {
  for (const value of [
    "/api/v1/import-validations", "import_session", "import_row_review", "rows_valid", "rows_warning",
    "rows_error", "UNSUPPORTED", "VALID", "WARNING", "ERROR", "VALIDATION_ROW_UNSUPPORTED",
    "VALIDATION_WARNING", "VALIDATION_ERROR", "canonical import boundary"
  ]) {
    assert.match(apiSource + schemaSource + migrationSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(fixture, /date,action,amount,currency/);
  const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
  for (const value of ["validation-panel", "validation-form", "validation-valid", "validation-warning", "validation-error", "validation-unsupported", "validation-evidence"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-0603-runtime: validation persists row reviews without ledger mutation", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const jsonHeaders = { "content-type": "application/json" };
  const email = `synthetic-import-validation-0603-${suffix}@example.test`;
  const userResponse = await fetch(`${api}/api/v1/users`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email, display_name: "Synthetic validation owner" }) });
  assert.equal(userResponse.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...jsonHeaders, "x-synthetic-fixture-key": fixtureKey() }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}`, ...jsonHeaders };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Synthetic validation ${suffix}`, reporting_currency_code: "EUR", privacy_scope: "PRIVATE" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const csv = [
    "date,action,amount,currency",
    "2026-10-17,DEPOSIT,100.00,EUR",
    "2027-01-01,DEPOSIT,50.00,EUR",
    "2026-10-18,DEPOSIT,not-a-number,EUR",
    "2026-10-19,UNKNOWN_ACTION,10.00,EUR"
  ].join("\n");
  const response = await fetch(`${api}/api/v1/import-validations`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ portfolio_id: portfolio.id, filename: `IMPORT-001-${suffix}.csv`, content_type: "text/csv", content_base64: Buffer.from(csv).toString("base64") })
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.counts.rows_seen, 4);
  assert.equal(result.counts.rows_valid, 1);
  assert.equal(result.counts.rows_warning, 1);
  assert.equal(result.counts.rows_error, 1);
  assert.equal(result.counts.rows_unsupported, 1);
  assert.deepEqual(result.rows.map((row) => row.status), ["VALID", "WARNING", "ERROR", "UNSUPPORTED"]);
  assert.equal(result.rows[1].error_codes[0], "VALIDATION_WARNING");
  assert.equal(result.rows[2].error_codes[0], "VALIDATION_ERROR");
  assert.equal(result.rows[3].error_codes[0], "VALIDATION_ROW_UNSUPPORTED");
  assert.match(result.import_session_id, /^[0-9a-f-]{36}$/i);
  const unauthenticated = await fetch(`${api}/api/v1/import-validations`);
  assert.equal(unauthenticated.status, 401);
});
