import test from "node:test";
import assert from "node:assert/strict";
import { planFireScenario } from "../../apps/api/src/fire-scenarios.ts";

function baseScenario(overrides = {}) {
  return {
    horizon_years: 30,
    annual_contribution: 12000,
    expected_return: 0.05,
    inflation_rate: 0.02,
    tax_rate: 0.25,
    initial_capital: 50000,
    monte_carlo: { iterations: 1000, seed: 42, volatility: 0.12, distribution: "NORMAL" },
    ...overrides
  };
}

test("US-1408-A unit: retirement scenario stores contributions, return, inflation, taxes and horizon", () => {
  const scenario = planFireScenario(baseScenario());
  assert.equal(scenario.assumptions.horizon_years, 30);
  assert.equal(scenario.assumptions.annual_contribution, "12000.000000000000");
  assert.equal(scenario.assumptions.expected_return, "0.050000000000");
  assert.equal(scenario.assumptions.inflation_rate, "0.020000000000");
  assert.equal(scenario.assumptions.tax_rate, "0.250000000000");
  assert.equal(scenario.calculation_version, "fire-scenario-v1");
  assert.equal(scenario.read_only, true);
  assert.ok(Number(scenario.result.projected_nominal) > 0);
});

test("US-1408-B unit: Monte Carlo is reproducible with seed and distributions", () => {
  const first = planFireScenario(baseScenario());
  const second = planFireScenario(baseScenario());
  assert.equal(first.monte_carlo.iterations, 1000);
  assert.equal(first.monte_carlo.seed, "42");
  assert.equal(first.monte_carlo.distribution, "NORMAL");
  assert.deepEqual(first.monte_carlo.result, second.monte_carlo.result);
  assert.ok(first.monte_carlo.result.median >= first.monte_carlo.result.p10);
  assert.ok(first.monte_carlo.result.p90 >= first.monte_carlo.result.median);
});

test("US-1408-C unit: sensitivity and sequence-of-returns show assumptions and failure probability", () => {
  const scenario = planFireScenario(baseScenario());
  assert.equal(scenario.sensitivity.length, 3);
  assert.equal(scenario.sequence_of_returns.length, 2);
  for (const variant of [...scenario.sensitivity, ...scenario.sequence_of_returns]) {
    assert.ok(variant.assumptions);
    assert.match(variant.variant, /./);
    assert.ok(Number(variant.failure_probability) >= 0 && Number(variant.failure_probability) <= 1);
  }
});

test("US-1408 unit: invalid horizon and return are rejected", () => {
  assert.throws(() => planFireScenario(baseScenario({ horizon_years: 0 })), /INVALID_FIRE_SCENARIO/);
  assert.throws(() => planFireScenario(baseScenario({ expected_return: 5 })), /INVALID_FIRE_SCENARIO/);
});
