import test from "node:test";
import assert from "node:assert/strict";
import { calculateRiskMetrics } from "../../apps/api/src/risk-metrics.ts";

const fixture = {
  periodStart: "2026-01-01",
  periodEnd: "2026-04-01",
  portfolioReturns: [0.10, -0.05, 0.08, -0.02],
  benchmarkReturns: [0.08, -0.03, 0.05, -0.01],
  riskFreeAnnual: 0.02,
  periodsPerYear: 4,
};

test("US-1201-A unit: volatility and drawdown expose observations and missing-data rule", () => {
  const result = calculateRiskMetrics(fixture);
  assert.equal(result.observations, 4);
  assert.equal(result.volatility_pct.toFixed(4), "14.7309");
  assert.equal(result.max_drawdown_pct.toFixed(4), "-5.0000");
  assert.equal(result.assumptions.missing_data_rule, "pairwise observations only; incomplete benchmark pairs are excluded");
  assert.equal(result.calculation_version, "risk-metrics-v1");
});

test("US-1201-B unit: beta, Sharpe and Sortino use benchmark and risk-free assumptions", () => {
  const result = calculateRiskMetrics(fixture);
  assert.equal(result.beta.toFixed(4), "1.4254");
  assert.equal(result.sharpe.toFixed(4), "0.6120");
  assert.equal(result.sortino.toFixed(4), "1.4934");
  assert.deepEqual(result.assumptions, {
    benchmark: "synthetic benchmark returns",
    risk_free_annual: 0.02,
    annualization_periods: 4,
    missing_data_rule: "pairwise observations only; incomplete benchmark pairs are excluded",
  });
});

test("US-1201 unit: insufficient observations are explicit instead of fabricated", () => {
  const result = calculateRiskMetrics({ ...fixture, portfolioReturns: [0.01], benchmarkReturns: [0.02] });
  assert.equal(result.observations, 1);
  assert.equal(result.volatility_pct, null);
  assert.equal(result.beta, null);
  assert.equal(result.sharpe, null);
  assert.equal(result.sortino, null);
});
