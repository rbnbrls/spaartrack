import test from "node:test";
import assert from "node:assert/strict";
import { projectRestrictedView } from "../../apps/api/src/restricted-view.ts";

const positions = [
  { instrument_id: "a", name: "Equity A", market_value: "6000.000000000000", currency_code: "EUR" },
  { instrument_id: "b", name: "Bond B", market_value: "4000.000000000000", currency_code: "EUR" }
];

test("US-1502 unit: restricted view exposes percentages without monetary values", () => {
  const view = projectRestrictedView({ positions, portfolio_value: "10000.000000000000", currency_code: "EUR" });
  assert.equal(view.positions.length, 2);
  assert.equal(view.positions[0].allocation_pct, "60.000000000000");
  assert.equal(view.positions[1].allocation_pct, "40.000000000000");
  for (const row of view.positions) {
    assert.ok(!("market_value" in row), "monetary value must be absent");
    assert.ok(!("amount" in row), "monetary amount must be absent");
    assert.ok(row.relative_weight);
  }
  assert.equal(view.calculation_version, "restricted-view-v1");
  assert.equal(view.read_only, true);
  const text = JSON.stringify(view);
  assert.ok(!text.includes("6000") && !text.includes("4000") && !text.includes("10000"));
});

test("US-1502 unit: weights total 100 percent with largest remainder", () => {
  const view = projectRestrictedView({
    positions: [
      { instrument_id: "a", name: "A", market_value: "1", currency_code: "EUR" },
      { instrument_id: "b", name: "B", market_value: "1", currency_code: "EUR" },
      { instrument_id: "c", name: "C", market_value: "1", currency_code: "EUR" }
    ],
    portfolio_value: "3",
    currency_code: "EUR"
  });
  const total = view.positions.reduce((sum, row) => sum + Number(row.allocation_pct), 0);
  assert.ok(Math.abs(total - 100) < 1e-9);
});

test("US-1502 unit: zero portfolio total falls back to position sum", () => {
  const view = projectRestrictedView({ positions, portfolio_value: "0", currency_code: "EUR" });
  assert.equal(view.allocation_total_pct, "100.000000000000");
});
