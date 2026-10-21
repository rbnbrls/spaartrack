import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = apiUrl;

test("TC-US-1701: incident router groups alerts and preserves trace evidence", () => {
  for (const value of ["incidentRoutingRoute", "/api/v1/incidents/alerts", "incidentFingerprint", "incident_event", "fingerprint", "grouping_window_minutes", "correlation_id", "trace_id"]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["incident-router-panel", "fingerprint", "SEV-2", "correlation", "trace"]) assert.match(webSource, new RegExp(value, "i"));
  assert.match(webSource, /html,body\{height:100%;overflow:hidden\}/);
  assert.match(webSource, /data-nav="Settings"/);
});

test("TC-US-1701-runtime: repeated synthetic alerts return one active incident", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-incident-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic Incident Owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const auth = { authorization: `Bearer ${(await login.json()).token}`, ...headers };
  const payload = { title: `Synthetic API timeout ${suffix}`, service: "api", environment: "local", release: "local", severity: "SEV-2", message: `request timeout ${suffix}`, occurred_at: "2026-10-18T10:00:00.000Z", correlation_id: `corr-${suffix}`, trace_id: `trace-${suffix}` };
  const first = await fetch(`${api}/api/v1/incidents/alerts`, { method: "POST", headers: auth, body: JSON.stringify(payload) });
  assert.equal(first.status, 201);
  const firstBody = await first.json();
  const second = await fetch(`${api}/api/v1/incidents/alerts`, { method: "POST", headers: { ...auth, "x-correlation-id": `corr-repeat-${suffix}`, "x-trace-id": `trace-repeat-${suffix}` }, body: JSON.stringify({ ...payload, severity: "SEV-1" }) });
  assert.equal(second.status, 200);
  const secondBody = await second.json();
  assert.equal(secondBody.incident_id, firstBody.incident_id);
  assert.equal(secondBody.grouped, true);
  assert.equal(secondBody.severity, "SEV-1");
  assert.ok(secondBody.trace_id);
  assert.ok(secondBody.correlation_id);
  const list = await fetch(`${api}/api/v1/incidents`, { headers: { authorization: auth.authorization } });
  assert.equal(list.status, 200);
  const listBody = await list.json();
  assert.ok(listBody.incidents.some((item) => item.id === firstBody.incident_id && item.events.length >= 2));
});
