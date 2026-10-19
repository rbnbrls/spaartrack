import test from "node:test";
import assert from "node:assert/strict";
import { buildBondCurveScenario } from "../../apps/api/src/bond-curve-scenario.ts";

const curve = [
  { tenorDays: 30, zeroRate: 0.021 },
  { tenorDays: 365, zeroRate: 0.024 },
  { tenorDays: 1095, zeroRate: 0.029 }
];

test("US-1403: parallel shift produces reproducible versioned curve observations", () => {
  const result = buildBondCurveScenario({ curve, parallelShift: 0.01, asOfDate: "2026-10-18", currencyCode: "EUR" });
  assert.equal(result.calculation_version, "bond-curve-scenario-v1");
  assert.equal(result.curve_version, "synthetic-curve-v1");
  assert.equal(result.read_only, true);
  assert.equal(result.source, "synthetic_curve");
  assert.equal(result.as_of_date, "2026-10-18");
  assert.equal(result.currency_code, "EUR");
  assert.equal(result.parallel_shift, "0.010000000000");
  assert.deepEqual(result.observations, [
    { tenor_days: 30, zero_rate: "0.021000000000", shifted_zero_rate: "0.031000000000" },
    { tenor_days: 365, zero_rate: "0.024000000000", shifted_zero_rate: "0.034000000000" },
    { tenor_days: 1095, zero_rate: "0.029000000000", shifted_zero_rate: "0.039000000000" }
  ]);
  assert.equal(result.assumptions.shift_type, "PARALLEL");
});

test("US-1403: unchanged inputs reproduce the same base curve", () => {
  const first = buildBondCurveScenario({ curve, parallelShift: 0 });
  const second = buildBondCurveScenario({ curve, parallelShift: 0 });
  assert.deepEqual(first.observations, second.observations);
  assert.equal(first.parallel_shift, "0.000000000000");
});

test("US-1403: invalid curves and shifts are rejected explicitly", () => {
  assert.throws(() => buildBondCurveScenario({ curve: [{ tenorDays: 365, zeroRate: 0.02 }, { tenorDays: 30, zeroRate: 0.01 }] }), /INVALID_BOND_CURVE/);
  assert.throws(() => buildBondCurveScenario({ curve: [{ tenorDays: 30, zeroRate: 0.02 }, { tenorDays: 30, zeroRate: 0.03 }] }), /INVALID_BOND_CURVE/);
  assert.throws(() => buildBondCurveScenario({ curve: [{ tenorDays: 30, zeroRate: 0.02 }, { tenorDays: 365, zeroRate: 0.03 }], parallelShift: -1 }), /INVALID_BOND_CURVE_SHIFT/);
  assert.throws(() => buildBondCurveScenario({ curve: [{ tenorDays: 30, zeroRate: 101 }] }), /INVALID_BOND_CURVE/);
});
