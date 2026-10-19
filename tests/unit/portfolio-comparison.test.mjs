import test from "node:test";
import assert from "node:assert/strict";
import { comparePortfolios } from "../../apps/api/src/portfolio-comparison.ts";

const input = {
  periodStart: "2026-01-01",
  periodEnd: "2026-05-01",
  portfolios: [
    {
      id: "portfolio-a",
      name: "Synthetic Core",
      currency: "EUR",
      startValue: 10000,
      endValue: 11200,
      netCashFlow: 200,
      allocation: { EQUITY: 0.6, CASH: 0.4 },
      risk: { volatilityPct: 12.5, maxDrawdownPct: -4.2, sharpe: 0.8 },
    },
    {
      id: "portfolio-b",
      name: "Synthetic Income",
      currency: "EUR",
      startValue: 10000,
      endValue: 10800,
      netCashFlow: 0,
      allocation: { EQUITY: 0.4, CASH: 0.6 },
      risk: { volatilityPct: 8.5, maxDrawdownPct: -2.1, sharpe: 0.7 },
    },
  ],
};

test("US-1206 unit: comparison keeps period, allocation, performance and risk aligned", () => {
  const result = comparePortfolios(input);
  assert.deepEqual(result.period, { start: "2026-01-01", end: "2026-05-01" });
  assert.deepEqual(result.currencies, ["EUR"]);
  assert.equal(result.portfolios.length, 2);
  assert.equal(result.portfolios[0].performance.returnPct, 10);
  assert.equal(result.portfolios[0].allocation.totalPct, 100);
  assert.equal(result.portfolios[0].risk.volatilityPct, 12.5);
  assert.equal(result.calculationVersion, "portfolio-comparison-v1");
});

test("US-1206 unit: mixed currencies and invalid periods are rejected", () => {
  assert.throws(() => comparePortfolios({ ...input, portfolios: input.portfolios.map((item, index) => ({ ...item, currency: index ? "USD" : "EUR" })) }), /COMPARISON_CURRENCY_MISMATCH/);
  assert.throws(() => comparePortfolios({ ...input, periodStart: "2026-05-01", periodEnd: "2026-01-01" }), /INVALID_COMPARISON_PERIOD/);
});

test("US-1206 unit: allocation must total 100 percent for every compared portfolio", () => {
  assert.throws(
    () => comparePortfolios({
      ...input,
      portfolios: input.portfolios.map((portfolio, index) => index === 1
        ? { ...portfolio, allocation: { EQUITY: 0.4, CASH: 0.5 } }
        : portfolio),
    }),
    /INVALID_COMPARISON_ALLOCATION/,
  );
});
