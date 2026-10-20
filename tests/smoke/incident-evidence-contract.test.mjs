import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-1702: evidence bundle contract is redacted, traceable and linked to operations context", () => {
  for (const value of ["incidentEvidenceRoute", "/api/v1/incidents/", "/evidence", "incident-evidence-v1", "pii_redacted", "migration_result", "image_digest", "redacted_exemplars"]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["incident-evidence-panel", "Collect evidence", "redacted", "image digest", "migration"]) {
    assert.match(webSource, new RegExp(value, "i"));
  }
  assert.match(webSource, /html,body\{height:100%;overflow:hidden\}/);
  assert.match(webSource, /data-nav="Settings"/);
});

test("TC-US-1702-runtime: synthetic incident evidence can be collected without ledger mutation", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-evidence-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic Evidence Owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/sessions`, { method: "POST", headers, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const auth = { authorization: `Bearer ${(await login.json()).token}`, ...headers };
  const alert = await fetch(`${api}/api/v1/incidents/alerts`, { method: "POST", headers: auth, body: JSON.stringify({ title: `Synthetic evidence ${suffix}`, service: "api", environment: "local", release: "release-1702", severity: "SEV-2", message: "synthetic failure", correlation_id: `corr-${suffix}`, trace_id: `trace-${suffix}` }) });
  assert.equal(alert.status, 201);
  const incident = await alert.json();
  const evidence = await fetch(`${api}/api/v1/incidents/${incident.incident_id}/evidence`, { method: "POST", headers: auth, body: JSON.stringify({
    logs: [{ level: "error", service: "api", message: `failed for ${email}`, fields: { authorization: "Bearer synthetic-secret" } }],
    traces: [{ trace_id: `trace-${suffix}`, operation: "synthetic.operation" }],
    metrics: [{ name: "api_errors_total", value: 1 }],
    release: { release: "release-1702", commit_sha: "e".repeat(40), image_digest: "sha256:" + "f".repeat(64), migration_result: "SUCCEEDED" },
    runbooks: ["docs/runbooks/incident-response.md"]
  }) });
  assert.equal(evidence.status, 201);
  const body = await evidence.json();
  assert.equal(body.calculation_version, "incident-evidence-v1");
  assert.equal(body.pii_redacted, true);
  assert.match(body.logs[0].message, /\[REDACTED_EMAIL\]/);
  assert.equal(body.release.commit_sha, "e".repeat(40));
  assert.ok(body.trace_id);
  assert.ok(body.correlation_id);
});
