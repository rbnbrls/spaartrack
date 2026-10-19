import test from "node:test";
import assert from "node:assert/strict";
import { buildTaxLossHarvestingCandidates } from "../../apps/api/src/tax-loss-harvesting.ts";

test("US-1305 unit: returns loss candidates with saving, holding period and rationale", () => {
  const result = buildTaxLossHarvestingCandidates({
    asOf: "2026-10-18",
    estimatedTaxRate: 0.25,
    lots: [
      { acquisitionTransactionId: "lot-short", acquisitionDate: "2026-01-10", remainingQuantity: 10, costBasis: 100, marketValue: 80, currency: "EUR" },
      { acquisitionTransactionId: "lot-long", acquisitionDate: "2025-01-01", remainingQuantity: 5, costBasis: 50, marketValue: 45, currency: "EUR" },
      { acquisitionTransactionId: "lot-gain", acquisitionDate: "2026-02-01", remainingQuantity: 3, costBasis: 30, marketValue: 40, currency: "EUR" }
    ]
  });

  assert.equal(result.calculation_version, "tax-loss-harvesting-v1");
  assert.equal(result.source, "canonical-ledger");
  assert.equal(result.read_only, true);
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.candidates.map((item) => item.acquisition_transaction_id), ["lot-short", "lot-long"]);
  assert.equal(result.candidates[0].unrealized_loss, "-20.000000000000");
  assert.equal(result.candidates[0].estimated_tax_saving, "5.000000000000");
  assert.equal(result.candidates[0].holding_period, "SHORT");
  assert.match(result.candidates[0].rationale, /loss/i);
  assert.equal(result.candidates[1].holding_period, "LONG");
  assert.equal(result.totals.unrealized_loss, "-25.000000000000");
  assert.equal(result.totals.estimated_tax_saving, "6.250000000000");
});

test("US-1305 unit: rejects invalid assumptions and ignores zero-loss lots", () => {
  assert.throws(() => buildTaxLossHarvestingCandidates({ asOf: "2026-10-18", estimatedTaxRate: 1.1, lots: [] }), /INVALID_TAX_LOSS_HARVESTING_INPUT/);
  const result = buildTaxLossHarvestingCandidates({
    asOf: "2026-10-18", estimatedTaxRate: 0.3,
    lots: [{ acquisitionTransactionId: "flat", acquisitionDate: "2026-01-01", remainingQuantity: 1, costBasis: 10, marketValue: 10, currency: "EUR" }]
  });
  assert.deepEqual(result.candidates, []);
});
