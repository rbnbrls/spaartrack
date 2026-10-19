import test from "node:test";
import assert from "node:assert/strict";
import { calculateRealizedGains } from "../../apps/api/src/tax-lots.ts";

test("US-1303 unit: decomposes realized gain into proceeds, cost basis, fees, tax and FX", () => {
  const result = calculateRealizedGains({
    asOf: "2026-10-18",
    baseCurrency: "EUR",
    transactions: [
      { id: "buy-old", activityType: "BUY", effectiveDate: "2025-01-10", occurredAt: "2025-01-10T10:00:00.000Z", quantity: 10, amount: 100, fee: 2, tax: 1, currency: "USD", fxRateToBase: 0.9 },
      { id: "buy-new", activityType: "BUY", effectiveDate: "2026-02-01", occurredAt: "2026-02-01T10:00:00.000Z", quantity: 5, amount: 70, fee: 1, tax: 0, currency: "USD", fxRateToBase: 0.95 },
      { id: "sell-one", activityType: "SELL", effectiveDate: "2026-03-01", occurredAt: "2026-03-01T10:00:00.000Z", quantity: 6, amount: 120, fee: 3, tax: 4, currency: "USD", fxRateToBase: 1.1 }
    ]
  });

  assert.equal(result.calculation_version, "realized-gains-v1");
  assert.equal(result.base_currency, "EUR");
  assert.equal(result.disposals.length, 1);
  assert.deepEqual(result.disposals[0], {
    disposal_transaction_id: "sell-one",
    acquisition_transaction_id: "buy-old",
    quantity: "6.000000000000",
    proceeds: "117.000000000000",
    cost_basis: "61.800000000000",
    fees: "4.200000000000",
    taxes: "4.600000000000",
    transaction_currency_gain: "55.200000000000",
    historical_cost_base: "55.620000000000",
    disposal_proceeds_base: "128.700000000000",
    fx_gain: "12.360000000000",
    taxable_result: "55.200000000000",
    currency: "USD",
    acquisition_fx_rate: "0.900000000000",
    disposal_fx_rate: "1.100000000000"
  });
  assert.equal(result.totals.taxable_result, "55.200000000000");
  assert.equal(result.totals.fx_gain, "12.360000000000");
});

test("US-1303 unit: rejects missing FX and oversells", () => {
  const base = { id: "buy", activityType: "BUY", effectiveDate: "2026-01-01", occurredAt: "2026-01-01T00:00:00.000Z", quantity: 1, amount: 10, fee: 0, tax: 0, currency: "USD", fxRateToBase: 1 };
  assert.throws(() => calculateRealizedGains({ asOf: "2026-10-18", baseCurrency: "EUR", transactions: [{ ...base, fxRateToBase: 0 }, { ...base, id: "sell", activityType: "SELL", amount: 12 }] }), /INVALID_REALIZED_GAIN_INPUT/);
  assert.throws(() => calculateRealizedGains({ asOf: "2026-10-18", baseCurrency: "EUR", transactions: [base, { ...base, id: "sell", activityType: "SELL", quantity: 2 }] }), /INSUFFICIENT_TAX_LOT_QUANTITY/);
});
