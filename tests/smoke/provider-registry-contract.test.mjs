import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0801: provider registry exposes capabilities, auth mode, API version and status", () => {
  for (const value of ["/api/v1/providers", "providerRegistryRoute", "provider_capability", "auth_mode", "api_version", "DEGRADED", "PAUSED", "provider-registry-v1", "ON CONFLICT.*slug.*DO NOTHING.*RETURNING"]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["provider-registry", "provider-registry-form", "provider-auth-mode", "provider-api-version", "provider-status", "provider-capabilities"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-0801-runtime: synthetic provider can be configured and paused", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-provider-0801-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic provider owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const create = await fetch(`${api}/api/v1/providers`, { method: "POST", headers: auth, body: JSON.stringify({ slug: `synthetic-${suffix.replace(/[^0-9]/g, "").slice(-8)}`, name: "Synthetic Broker", provider_type: "BROKER", auth_mode: "API_KEY", api_version: "2026-01", status: "ACTIVE", capabilities: [{ capability: "BALANCES", supported: true }, { capability: "TRANSACTIONS", supported: true }] }) });
  assert.equal(create.status, 201);
  const provider = await create.json();
  assert.equal(provider.auth_mode, "API_KEY");
  assert.equal(provider.api_version, "2026-01");
  assert.equal(provider.capabilities.length, 2);
  const paused = await fetch(`${api}/api/v1/providers/${provider.slug}`, { method: "PATCH", headers: auth, body: JSON.stringify({ status: "PAUSED" }) });
  assert.equal(paused.status, 200);
  assert.equal((await paused.json()).status, "PAUSED");
  const listed = await fetch(`${api}/api/v1/providers`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(listed.status, 200);
  assert.ok((await listed.json()).providers.some((item) => item.slug === provider.slug));
  assert.equal((await fetch(`${api}/api/v1/providers`)).status, 401);
});
