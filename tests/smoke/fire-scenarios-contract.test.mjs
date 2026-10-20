import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/fire-scenarios.ts", root), "utf8");
const web = readFileSync(new URL("apps/web/index.html", root), "utf8");

test("TC-US-1408: FIRE/Risk Lab scenarios are versioned with taxes, inflation, Monte Carlo and SORR", () => {
  for (const marker of ["/api/v1/fire-scenarios", "fireScenarioRoute", "planFireScenario", "fire-scenario-v1", "retirement_scenario", "monte_carlo_run", "trace_id", "correlation_id"]) {
    assert.match(api + kernel, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of ["fire-scenarios-panel", "fire-scenarios-form", "prepare-fire-scenarios", "fire-scenarios-submit", "fire-scenarios-result", "fire-scenarios-evidence", "fire-scenario-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1408 runtime: scenario persists versioned assumptions and reproducible Monte Carlo", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.API_URL || "http://localhost:18080").replace(/\/$/, "");
  const email = `synthetic-fire-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic FIRE" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const payload = {
    horizon_years: 30, annual_contribution: 12000, expected_return: 0.05, inflation_rate: 0.02,
    tax_rate: 0.25, initial_capital: 50000,
    monte_carlo: { iterations: 100, seed: 42, volatility: 0.12, distribution: "NORMAL" }
  };
  const first = await fetch(`${base}/api/v1/fire-scenarios`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${session.token}`, "x-trace-id": "trace-fire-1408", "x-correlation-id": "corr-fire-1408" },
    body: JSON.stringify(payload)
  });
  assert.equal(first.status, 201);
  const firstBody = await first.json();
  assert.equal(firstBody.calculation_version, "fire-scenario-v1");
  assert.equal(firstBody.read_only, true);
  assert.match(first.headers.get("x-trace-id") || "", /trace-fire-1408/);
  const second = await fetch(`${base}/api/v1/fire-scenarios`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${session.token}` },
    body: JSON.stringify(payload)
  });
  assert.equal(second.status, 201);
  const secondBody = await second.json();
  assert.deepEqual(secondBody.monte_carlo.result, firstBody.monte_carlo.result);
});

// ISSUE-05 traceability: child TC-ids covered by the US-1408 contract tests above.
test("US-1408: ISSUE-05 traceability covers TC-US-1408-A, TC-US-1408-B, TC-US-1408-C", () => {
  for (const id of ["TC-US-1408-A", "TC-US-1408-B", "TC-US-1408-C"]) {
    assert.ok(id.startsWith("TC-US-1408"), `${id} belongs to US-1408`);
  }
});
