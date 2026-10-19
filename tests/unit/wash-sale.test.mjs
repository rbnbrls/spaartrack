import test from "node:test";
import assert from "node:assert/strict";
import { detectWashSaleRisks } from "../../apps/api/src/wash-sale.ts";

test("US-1306 unit: flags a related purchase inside the wash-sale window", () => {
  const result = detectWashSaleRisks({
    windowDays: 30,
    lossSales: [{ id: "sell-loss", instrumentId: "asset-a", instrumentName: "Synthetic Equity A", disposalDate: "2026-10-01", quantity: 10, lossAmount: 20, currency: "EUR" }],
    purchases: [{ id: "buy-related", instrumentId: "asset-a", instrumentName: "Synthetic Equity A", purchaseDate: "2026-10-15", quantity: 10, currency: "EUR" }]
  });

  assert.equal(result.calculation_version, "wash-sale-v1");
  assert.equal(result.risks.length, 1);
  assert.equal(result.risks[0].status, "AT_RISK");
  assert.equal(result.risks[0].confidence, "HIGH");
  assert.equal(result.risks[0].related_instrument_id, "asset-a");
  assert.deepEqual(result.risks[0].relevant_window, { start: "2026-09-01", end: "2026-10-31" });
});

test("US-1306 unit: ignores purchases outside the window and validates inputs", () => {
  const result = detectWashSaleRisks({
    windowDays: 30,
    lossSales: [{ id: "sell-loss", instrumentId: "asset-a", disposalDate: "2026-10-01", quantity: 10, lossAmount: 20, currency: "EUR" }],
    purchases: [{ id: "buy-late", instrumentId: "asset-a", purchaseDate: "2026-12-01", quantity: 10, currency: "EUR" }]
  });
  assert.equal(result.risks[0].status, "CLEAR");
  assert.equal(result.risks[0].confidence, "LOW");
  assert.throws(() => detectWashSaleRisks({ windowDays: 0, lossSales: [], purchases: [] }), /INVALID_WASH_SALE_INPUT/);
});
