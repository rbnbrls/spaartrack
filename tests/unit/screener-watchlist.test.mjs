import test from "node:test";
import assert from "node:assert/strict";
import { buildScreenerDefinition, validateScreenerDefinition } from "../../apps/api/src/screener-watchlist.ts";

test("US-1208 unit: stores fundamentals, performance, target and alert filters", () => {
  const definition = buildScreenerDefinition({
    name: "Synthetic quality watchlist",
    filters: {
      fundamentals: [{ field: "dividend_yield", operator: "gte", value: 3 }],
      performance: [{ field: "return_1y", operator: "gte", value: 8 }],
      targets: [{ field: "drift_percentage_points", operator: "gt", value: 5 }],
      alerts: [{ field: "price_change_pct", operator: "lte", value: -4 }]
    }
  });
  assert.equal(definition.name, "Synthetic quality watchlist");
  assert.equal(definition.filters.fundamentals[0].field, "dividend_yield");
  assert.equal(definition.filters.performance[0].value, 8);
  assert.equal(definition.filters.targets[0].operator, "gt");
  assert.equal(definition.filters.alerts[0].value, -4);
  assert.equal(definition.calculation_version, "screener-watchlist-v1");
});

test("US-1208 unit: rejects unsupported filter dimensions and operators", () => {
  assert.throws(() => validateScreenerDefinition({ name: "bad", filters: { unknown: [] } }), /INVALID_SCREENER_FILTER_DIMENSION/);
  assert.throws(() => validateScreenerDefinition({ name: "bad", filters: { fundamentals: [{ field: "xx", operator: "contains", value: 1 }] } }), /INVALID_SCREENER_FILTER_OPERATOR/);
});
