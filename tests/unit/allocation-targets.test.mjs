import test from "node:test";
import assert from "node:assert/strict";
import { validateAllocationTargets } from "../../apps/api/src/allocation-targets.ts";

const valid = {
  dimension: "ASSET_CLASS",
  targets: [
    { key: "EQUITY", label: "Equity", targetPercentage: 60 },
    { key: "FIXED_INCOME", label: "Fixed income", targetPercentage: 30 },
    { key: "CASH", label: "Cash", targetPercentage: 10 },
  ],
};

test("US-1204 unit: validates a complete target set per supported dimension", () => {
  const result = validateAllocationTargets(valid);
  assert.equal(result.dimension, "ASSET_CLASS");
  assert.equal(result.total_percentage, 100);
  assert.equal(result.targets.length, 3);
  assert.equal(result.calculation_version, "allocation-targets-v1");
});

test("US-1204 unit: rejects duplicate labels, invalid percentages and incomplete totals", () => {
  assert.throws(() => validateAllocationTargets({ ...valid, dimension: "INVALID" }), /INVALID_ALLOCATION_DIMENSION/);
  assert.throws(() => validateAllocationTargets({ ...valid, targets: [{ ...valid.targets[0], targetPercentage: 99 }] }), /ALLOCATION_TARGET_TOTAL_MUST_EQUAL_100/);
  assert.throws(() => validateAllocationTargets({ ...valid, targets: [...valid.targets, { key: "EQUITY", label: "Again", targetPercentage: 0 }] }), /DUPLICATE_ALLOCATION_TARGET/);
  assert.throws(() => validateAllocationTargets({ ...valid, targets: [{ ...valid.targets[0], targetPercentage: -1 }, ...valid.targets.slice(1)] }), /INVALID_ALLOCATION_TARGET_PERCENTAGE/);
});
