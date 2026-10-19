import test from "node:test";
import assert from "node:assert/strict";
import { calculateDriftRebalance } from "../../apps/api/src/drift-rebalance.ts";

test("US-1205 unit: calculates current, target, drift and trade value", () => {
  const result = calculateDriftRebalance({
    dimension: "ASSET_CLASS",
    portfolioValue: 10000,
    holdings: [
      { key: "EQUITY", label: "Equity", currentValue: 7000 },
      { key: "CASH", label: "Cash", currentValue: 3000 },
    ],
    targets: [
      { key: "EQUITY", label: "Equity", targetPercentage: 60 },
      { key: "CASH", label: "Cash", targetPercentage: 40 },
    ],
    cashAvailable: 500,
  });

  assert.equal(result.calculation_version, "drift-rebalance-v1");
  assert.deepEqual(result.suggestions, [
    { key: "CASH", label: "Cash", current_percentage: 30, target_percentage: 40, drift_percentage_points: -10, current_value: 3000, target_value: 4000, trade_value: 1000, action: "BUY" },
    { key: "EQUITY", label: "Equity", current_percentage: 70, target_percentage: 60, drift_percentage_points: 10, current_value: 7000, target_value: 6000, trade_value: -1000, action: "SELL" },
  ]);
  assert.equal(result.required_cash, 1000);
  assert.equal(result.cash_available, 500);
  assert.equal(result.cash_shortfall, 500);
});

test("US-1205 unit: includes target-only buckets and refuses invalid totals", () => {
  const result = calculateDriftRebalance({
    dimension: "SECTOR", portfolioValue: 1000,
    holdings: [{ key: "TECH", label: "Technology", currentValue: 1000 }],
    targets: [{ key: "TECH", label: "Technology", targetPercentage: 50 }, { key: "HEALTH", label: "Healthcare", targetPercentage: 50 }],
  });
  assert.equal(result.suggestions.find((item) => item.key === "HEALTH")?.action, "BUY");
  assert.throws(() => calculateDriftRebalance({ dimension: "SECTOR", portfolioValue: 100, holdings: [], targets: [{ key: "TECH", label: "Technology", targetPercentage: 90 }] }), /ALLOCATION_TARGET_TOTAL_MUST_EQUAL_100/);
});
