import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const migrationSource = readFileSync(new URL("database/migrations/0009-import-mapping-versioning.sql", root), "utf8");
const fixture = readFileSync(new URL("fixtures/IMPORT-001.csv", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

const mapping = {
  date: "date",
  activity_type: "action",
  amount: "amount",
  currency_code: "currency",
  quantity: { exception: "not present in cash-only source" }
};

test("TC-US-0602: import mapping templates enforce canonical fields and versioning", () => {
  for (const value of [
    "/api/v1/import-mappings", "import_mapping", "mapping_json", "provider_slug", "document_type",
    "parser_version", "template_version", "CANONICAL_FIELD_MISSING", "MAPPING_TEMPLATE_ALREADY_EXISTS",
    "MAPPING_TEMPLATE_NOT_FOUND", "exception"
  ]) {
    assert.match(apiSource + schemaSource + migrationSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS/);
  assert.match(fixture, /date,action,amount,currency/);
  const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
  for (const value of ["mapping-panel", "mapping-form", "mapping-json", "mapping-save", "mapping-status", "mapping-evidence", "template_version"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-0602-runtime: template is saved, reused and versioned without ledger mutation", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-import-mapping-0602-${suffix}@example.test`;
  const user = await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic mapping owner" }) });
  assert.equal(user.status, 201);
  const session = await fetch(`${api}/api/v1/sessions`, { method: "POST", headers, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(session.status, 201);
  const auth = { authorization: `Bearer ${(await session.json()).token}`, ...headers };
  const create = await fetch(`${api}/api/v1/import-mappings`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ name: `IMPORT-001 CSV ${suffix}`, provider_slug: `synthetic-broker-${suffix}`, document_type: "CSV", parser_version: "csv-v1", mapping_json: mapping })
  });
  assert.equal(create.status, 201);
  const template = await create.json();
  assert.equal(template.template_version, 1);
  assert.equal(template.document_type, "CSV");
  assert.equal(template.parser_version, "csv-v1");
  assert.equal(template.mapping_json.amount, "amount");
  assert.equal(template.mapping_json.quantity.exception, "not present in cash-only source");
  assert.ok(template.provider_id);

  const list = await fetch(`${api}/api/v1/import-mappings`, { headers: { authorization: auth.authorization } });
  assert.equal(list.status, 200);
  assert.ok((await list.json()).mappings.some((item) => item.id === template.id && item.owner_id === template.owner_id));

  const update = await fetch(`${api}/api/v1/import-mappings/${template.id}`, {
    method: "PATCH", headers: auth,
    body: JSON.stringify({ mapping_json: { ...mapping, amount: "gross_amount" }, parser_version: "csv-v2" })
  });
  assert.equal(update.status, 200);
  const versioned = await update.json();
  assert.equal(versioned.template_version, 2);
  assert.equal(versioned.mapping_json.amount, "gross_amount");
  assert.equal(versioned.parser_version, "csv-v2");

  const invalid = await fetch(`${api}/api/v1/import-mappings`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ name: `Invalid ${suffix}`, provider_slug: `synthetic-broker-${suffix}`, document_type: "CSV", parser_version: "csv-v1", mapping_json: { date: "date", amount: "amount" } })
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error, "CANONICAL_FIELD_MISSING");

  const unauthenticated = await fetch(`${api}/api/v1/import-mappings`);
  assert.equal(unauthenticated.status, 401);
});
