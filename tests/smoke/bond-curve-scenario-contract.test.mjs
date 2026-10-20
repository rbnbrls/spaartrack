import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/bond-curve-scenario.ts", root), "utf8");
const web = readFileSync(new URL("apps/web/index.html", root), "utf8");

test("TC-US-1403: curve observations and parallel shifts are versioned and read-only", () => {
  for (const marker of ["buildBondCurveScenario", "synthetic-curve-v1", "bond-curve-scenario-v1", "parallel_shift", "shifted_zero_rate", "read_only"]) assert.match(kernel, new RegExp(marker));
  for (const marker of ["/api/v1/bond-curve-scenarios", "bondCurveScenarioRoute", "BOND_CURVE_SCENARIO", "trace_id", "correlation_id"]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const marker of ["bond-curve-scenario-panel", "bond-curve-scenario-form", "bond-curve-scenario-result", "bond-curve-scenario-v1", "bond-curve-run"]) assert.match(web, new RegExp(marker));
  for (const marker of ["ledger_transaction", "ledger_entry", "INSERT INTO spaartrack.ledger"]) assert.doesNotMatch(kernel, new RegExp(marker));
});

test("TC-US-1403-runtime: curve scenario endpoint is authenticated", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const base = process.env.API_URL || "http://localhost:18080";
  const response = await fetch(`${base}/api/v1/bond-curve-scenarios`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ curve: [] }) });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});

test("TC-US-1403-runtime: synthetic parallel shift returns reproducible scenario output", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = process.env.API_URL || "http://localhost:18080";
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-curve-${suffix}@example.test`, display_name: "Synthetic Curve Scenario" });
  const session = await create("/api/v1/test-fixtures/sessions", { email: user.email, ttl_seconds: 180 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const auth = { authorization: `Bearer ${session.token}` };
  const body = {
    as_of_date: "2026-10-18",
    currency_code: "EUR",
    parallel_shift: 0.01,
    curve: [{ tenor_days: 30, zero_rate: 0.021 }, { tenor_days: 365, zero_rate: 0.024 }, { tenor_days: 1095, zero_rate: 0.029 }]
  };
  const first = await create("/api/v1/bond-curve-scenarios", body, auth);
  const second = await create("/api/v1/bond-curve-scenarios", body, auth);
  assert.equal(first.calculation_version, "bond-curve-scenario-v1");
  assert.equal(first.curve_version, "synthetic-curve-v1");
  assert.equal(first.read_only, true);
  assert.deepEqual(first.observations, second.observations);
  assert.equal(first.observations[1].shifted_zero_rate, "0.034000000000");
  assert.ok(first.trace_id);
  assert.ok(first.correlation_id);
});
