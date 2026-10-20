import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const diagnosisSource = readFileSync(new URL("apps/api/src/incident-diagnosis.ts", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-1703: diagnosis hypothesis contract is versioned and traceable", () => {
  for (const value of ["incidentDiagnosisRoute", "/hypotheses", "incident-diagnosis-v1", "proposed_regression_test", "reproducibility_key"]) {
    assert.match(apiSource + diagnosisSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["incident-diagnosis-panel", "Build hypothesis", "confidence", "affected path", "regression test"]) {
    assert.match(webSource, new RegExp(value, "i"));
  }
  assert.match(webSource, /html,body\{height:100%;overflow:hidden\}/);
});

test("TC-US-1703-runtime: synthetic diagnosis hypothesis is read-only", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-diagnosis-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic Diagnosis Owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const auth = { authorization: `Bearer ${(await login.json()).token}`, ...headers };
  const alert = await fetch(`${api}/api/v1/incidents/alerts`, { method: "POST", headers: auth, body: JSON.stringify({ title: `Synthetic diagnosis ${suffix}`, service: "api", environment: "local", release: "release-1703", severity: "SEV-2", message: "synthetic failure", correlation_id: `corr-${suffix}`, trace_id: `trace-${suffix}` }) });
  assert.equal(alert.status, 201);
  const incident = await alert.json();
  const response = await fetch(`${api}/api/v1/incidents/${incident.incident_id}/hypotheses`, { method: "POST", headers: auth, body: JSON.stringify({ confidence: 0.91, affected_path: "POST /api/v1/incidents/:id/evidence", invariant: "ledger remains untouched", proposed_regression_test: "TC-US-1703-ledger-untouched", rationale: "Synthetic evidence path is operational-only." }) });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.calculation_version, "incident-diagnosis-v1");
  assert.equal(body.read_only, true);
  assert.equal(body.confidence, 0.91);
  assert.equal(body.ledger_untouched, true);
  assert.ok(body.reproducibility_key);
});
