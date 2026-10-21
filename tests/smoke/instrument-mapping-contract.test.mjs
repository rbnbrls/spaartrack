import { fixtureKey } from "../helpers/fixture-key.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const migrationSource = readFileSync(new URL("database/migrations/0007-instrument-mapping.sql", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0403: provider identity mapping and unresolved workflow are explicit", () => {
  for (const value of [
    "/api/v1/instrument-mappings", "instrument_mapping", "provider_slug", "provider_symbol",
    "identifier_type", "identifier_value", "UNRESOLVED", "RESOLVED", "MAPPING_ALREADY_EXISTS"
  ]) {
    assert.match(apiSource + schemaSource + migrationSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS (spaartrack\.)?instrument_mapping/);
  assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS/);
});

test("TC-US-0403-runtime: provider symbol can be unresolved, resolved, and read back with ISIN/CUSIP", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-mapping-0403-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic Identity Mapping" })
  });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: { "x-synthetic-fixture-key": fixtureKey(), "content-type": "application/json" },
    body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };

  const instrument = await fetch(`${api}/api/v1/instruments`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      name: `Synthetic Mapping Instrument ${suffix}`, instrument_type: "STOCK", asset_class: "EQUITY",
      currency_code: "USD", ticker: `MAP${String(Date.now()).slice(-6)}`, isin: `US${String(Date.now()).slice(-10)}X`,
      valuation_source: "MANUAL", is_listed: true
    })
  });
  assert.equal(instrument.status, 201);
  const instrumentBody = await instrument.json();

  const unresolved = await fetch(`${api}/api/v1/instrument-mappings`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ provider_slug: `synthetic-provider-${suffix}`, provider_symbol: "SYN-UNRESOLVED", identifier_type: "ISIN", identifier_value: "US-UNKNOWN" })
  });
  assert.equal(unresolved.status, 201);
  const unresolvedBody = await unresolved.json();
  assert.equal(unresolvedBody.status, "UNRESOLVED");
  assert.equal(unresolvedBody.provider_symbol, "SYN-UNRESOLVED");
  assert.equal(unresolvedBody.identifier_type, "ISIN");

  const listed = await fetch(`${api}/api/v1/instrument-mappings?status=UNRESOLVED`, { headers: auth });
  assert.equal(listed.status, 200);
  assert.ok((await listed.json()).mappings.some((mapping) => mapping.id === unresolvedBody.id));

  const resolved = await fetch(`${api}/api/v1/instrument-mappings/${unresolvedBody.id}`, {
    method: "PATCH", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ instrument_id: instrumentBody.id, status: "RESOLVED" })
  });
  assert.equal(resolved.status, 200);
  const resolvedBody = await resolved.json();
  assert.equal(resolvedBody.status, "RESOLVED");
  assert.equal(resolvedBody.instrument_id, instrumentBody.id);
  assert.ok(resolvedBody.resolved_at);

  const cusip = await fetch(`${api}/api/v1/instrument-mappings`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ provider_slug: `synthetic-provider-${suffix}`, provider_symbol: "SYN-CUSIP", instrument_id: instrumentBody.id, identifier_type: "CUSIP", identifier_value: "123456789" })
  });
  assert.equal(cusip.status, 201);
  assert.equal((await cusip.json()).status, "RESOLVED");

  const duplicate = await fetch(`${api}/api/v1/instrument-mappings`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ provider_slug: `synthetic-provider-${suffix}`, provider_symbol: "SYN-CUSIP", instrument_id: instrumentBody.id, identifier_type: "CUSIP", identifier_value: "123456789" })
  });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error, "MAPPING_ALREADY_EXISTS");

  const unauthenticated = await fetch(`${api}/api/v1/instrument-mappings`);
  assert.equal(unauthenticated.status, 401);
});
