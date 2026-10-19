import test from "node:test";
import assert from "node:assert/strict";
import { buildTaxLots, compareTaxLotMethods } from "../../apps/api/src/tax-lots.ts";

test("US-1301 unit: exposes acquisition lots with fees, currency and holding period", () => {
  const result = buildTaxLots({
    asOf: "2026-10-18",
    transactions: [
      { id: "buy-1", activityType: "BUY", effectiveDate: "2025-01-10", occurredAt: "2025-01-10T10:00:00.000Z", quantity: 10, amount: 100, fee: 2, tax: 1, currency: "EUR" },
      { id: "buy-2", activityType: "BUY", effectiveDate: "2026-02-01", occurredAt: "2026-02-01T10:00:00.000Z", quantity: 5, amount: 70, fee: 1, tax: 0, currency: "EUR" },
      { id: "sell-1", activityType: "SELL", effectiveDate: "2026-03-01", occurredAt: "2026-03-01T10:00:00.000Z", quantity: 12, amount: 240, fee: 3, tax: 0, currency: "EUR" }
    ]
  });

  assert.equal(result.calculation_version, "tax-lots-v1");
  assert.equal(result.lots.length, 2);
  assert.deepEqual(result.lots[0], {
    acquisition_transaction_id: "buy-1",
    acquisition_date: "2025-01-10",
    original_quantity: "10.000000000000",
    remaining_quantity: "0.000000000000",
    cost_basis: "103.000000000000",
    fees: "2.000000000000",
    currency: "EUR",
    holding_period: "LONG"
  });
  assert.equal(result.lots[1].remaining_quantity, "3.000000000000");
  assert.equal(result.lots[1].holding_period, "SHORT");
});

test("US-1301 unit: rejects invalid acquisition data and oversells", () => {
  assert.throws(() => buildTaxLots({ asOf: "2026-10-18", transactions: [{ id: "bad", activityType: "BUY", effectiveDate: "2026-01-01", occurredAt: "2026-01-01T00:00:00.000Z", quantity: 0, amount: 1, fee: 0, tax: 0, currency: "EUR" }] }), /INVALID_TAX_LOT_INPUT/);
  assert.throws(() => buildTaxLots({ asOf: "2026-10-18", transactions: [{ id: "sell", activityType: "SELL", effectiveDate: "2026-01-01", occurredAt: "2026-01-01T00:00:00.000Z", quantity: 1, amount: 1, fee: 0, tax: 0, currency: "EUR" }] }), /INSUFFICIENT_TAX_LOT_QUANTITY/);
});

test("US-1302 unit: compares deterministic lot allocation methods", () => {
  const result = compareTaxLotMethods({
    asOf: "2026-10-18",
    method: "ALL",
    specificIds: { "sell-one": [{ acquisition_transaction_id: "buy-new", quantity: 5 }, { acquisition_transaction_id: "buy-old", quantity: 1 }] },
    transactions: [
      { id: "buy-old", activityType: "BUY", effectiveDate: "2025-01-10", occurredAt: "2025-01-10T10:00:00.000Z", quantity: 10, amount: 100, fee: 2, tax: 0, currency: "EUR" },
      { id: "buy-new", activityType: "BUY", effectiveDate: "2026-02-01", occurredAt: "2026-02-01T10:00:00.000Z", quantity: 5, amount: 70, fee: 1, tax: 0, currency: "EUR" },
      { id: "sell-one", activityType: "SELL", effectiveDate: "2026-03-01", occurredAt: "2026-03-01T10:00:00.000Z", quantity: 6, amount: 120, fee: 3, tax: 0, currency: "EUR" }
    ]
  });

  assert.equal(result.calculation_version, "tax-lot-methods-v1");
  assert.deepEqual(result.methods.map((item) => item.method), ["FIFO", "LIFO", "WAC", "HIFO", "SPECIFIC_ID"]);
  assert.deepEqual(result.methods[0].disposals, [{ acquisition_transaction_id: "buy-old", quantity: "6.000000000000", cost_basis: "61.200000000000" }]);
  assert.deepEqual(result.methods[1].disposals, [{ acquisition_transaction_id: "buy-new", quantity: "5.000000000000", cost_basis: "71.000000000000" }, { acquisition_transaction_id: "buy-old", quantity: "1.000000000000", cost_basis: "10.200000000000" }]);
  assert.deepEqual(result.methods.find((item) => item.method === "WAC").disposals[0], { acquisition_transaction_id: "WAC_POOL", quantity: "6.000000000000", cost_basis: "69.200000000000" });
  assert.equal(result.methods.find((item) => item.method === "HIFO").disposals[0].acquisition_transaction_id, "buy-new");
  assert.throws(() => compareTaxLotMethods({ asOf: "2026-10-18", method: "NOPE", transactions: [] }), /INVALID_TAX_LOT_METHOD/);
});
