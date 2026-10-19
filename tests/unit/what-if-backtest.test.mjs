import test from "node:test";
import assert from "node:assert/strict";
import { runWhatIfBacktest } from "../../apps/api/src/what-if-backtest.ts";

const fixture = {
  periodStart: "2026-01-01",
  periodEnd: "2026-03-01",
  allocations: { EQUITY: 0.6, CASH: 0.4 },
  initialCapital: 10000,
  priceSeries: [
    { date: "2026-01-01", prices: { EQUITY: 100, CASH: 1 } },
    { date: "2026-02-01", prices: { EQUITY: 110, CASH: 1 } },
    { date: "2026-03-01", prices: { EQUITY: 121, CASH: 1 } },
  ],
  cashflows: [{ date: "2026-02-01", amount: 1000 }],
  costs: { percentage: 0.001, fixed: 2 },
  assumptions: { rebalance: "monthly", cashflowTreatment: "invest-on-date" },
};

test("US-1207 unit: what-if stores versioned assumptions and reproduces output", () => {
  const result = runWhatIfBacktest(fixture);
  assert.equal(result.calculation_version, "what-if-backtest-v1");
  assert.deepEqual(result.period, { start: "2026-01-01", end: "2026-03-01" });
  assert.deepEqual(result.assumptions, fixture.assumptions);
  assert.deepEqual(result.input_prices, fixture.priceSeries);
  assert.deepEqual(result.cashflows, fixture.cashflows);
  assert.deepEqual(result.costs, { percentage: 0.001, fixed: 2 });
  assert.equal(result.observations.length, 3);
  assert.equal(result.result.final_value, 12303.31);
  assert.equal(result.result.total_costs, 15);
  assert.equal(runWhatIfBacktest(fixture).result.final_value, result.result.final_value);
});

test("US-1207 unit: rejects invalid allocations, prices and periods", () => {
  assert.throws(() => runWhatIfBacktest({ ...fixture, allocations: { EQUITY: 0.7, CASH: 0.4 } }), /ALLOCATIONS_MUST_EQUAL_100/);
  assert.throws(() => runWhatIfBacktest({ ...fixture, periodStart: "2026-03-01", periodEnd: "2026-01-01" }), /INVALID_BACKTEST_PERIOD/);
  assert.throws(() => runWhatIfBacktest({ ...fixture, priceSeries: [{ date: "2026-01-01", prices: { EQUITY: 0, CASH: 1 } }] }), /INVALID_BACKTEST_PRICE/);
});
