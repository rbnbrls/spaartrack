import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const contractsSource = readFileSync(new URL("packages/integration-contracts/src/index.ts", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = apiUrl;

test("TC-US-1001: GoCardless institution selection exposes region, capabilities and availability", () => {
  for (const value of [
    "/api/v1/bank-institutions",
    "bankInstitutionRoute",
    "gocardless",
    "institution_id",
    "region",
    "capabilities",
    "availability",
    "bank-institution-catalog-v1"
  ]) {
    assert.match(apiSource + contractsSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["bank-institutions-panel", "bank-institutions-form", "bank-institution-region", "bank-institution-capabilities", "bank-institution-availability"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-1001-runtime: synthetic BANK-001 catalog filters GoCardless institutions without provider credentials", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const headers = { "content-type": "application/json" };
  const email = `synthetic-bank-1001-${Date.now()}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic bank owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const response = await fetch(`${api}/api/v1/bank-institutions?provider=gocardless&region=NL&capability=TRANSACTIONS`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.calculation_version, "bank-institution-catalog-v1");
  assert.equal(body.fixture, "BANK-001");
  assert.ok(body.institutions.length > 0);
  assert.ok(body.institutions.every((item) => item.provider_slug === "gocardless" && item.region === "NL"));
  assert.ok(body.institutions.every((item) => ["AVAILABLE", "DEGRADED", "UNAVAILABLE"].includes(item.availability.status)));
  assert.ok(body.institutions.every((item) => item.capabilities.includes("TRANSACTIONS")));
  assert.ok(body.trace_id);
  assert.ok(body.correlation_id);
  assert.equal((await fetch(`${api}/api/v1/bank-institutions`, { headers: { authorization: `Bearer ${token}` } })).status, 200);
  assert.equal((await fetch(`${api}/api/v1/bank-institutions`)).status, 401);
});
