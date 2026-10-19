import test from "node:test";
import assert from "node:assert/strict";
import { calculateEtfExposure } from "../../apps/api/src/etf-exposure.ts";

const fixture = {
  source: "synthetic-lookthrough",
  sourceVersion: "2026.10",
  asOf: "2026-05-01",
  holdings: [
    {
      instrumentId: "etf-a",
      name: "Synthetic World ETF",
      portfolioWeight: 0.6,
      components: [
        { holdingId: "underlying-a", name: "Synthetic Equity A", weight: 0.7, resolved: true },
        { holdingId: "underlying-b", name: "Synthetic Equity B", weight: 0.2, resolved: true },
        { holdingId: null, name: "Unresolved Synthetic Holding", weight: 0.1, resolved: false }
      ]
    },
    {
      instrumentId: "etf-b",
      name: "Synthetic Europe ETF",
      portfolioWeight: 0.4,
      components: [
        { holdingId: "underlying-a", name: "Synthetic Equity A", weight: 0.5, resolved: true },
        { holdingId: "underlying-c", name: "Synthetic Bond A", weight: 0.5, resolved: true }
      ]
    }
  ]
};

test("US-1203 unit: look-through exposure aggregates overlap and preserves source evidence", () => {
  const result = calculateEtfExposure(fixture);
  assert.equal(result.methodology, "etf-look-through-overlap-v1");
  assert.equal(result.source, "synthetic-lookthrough");
  assert.equal(result.source_version, "2026.10");
  assert.equal(result.as_of, "2026-05-01");
  assert.equal(result.coverage_pct, 94);
  assert.equal(result.unresolved_holdings.length, 1);
  assert.equal(result.unresolved_holdings[0].name, "Unresolved Synthetic Holding");
  assert.equal(result.overlap[0].name, "Synthetic Equity A");
  assert.equal(result.overlap[0].portfolio_exposure_pct.toFixed(2), "62.00");
  assert.equal(result.total_exposure_pct.toFixed(2), "100.00");
});

test("US-1203 unit: invalid component weights are rejected instead of inferred", () => {
  assert.throws(() => calculateEtfExposure({ ...fixture, holdings: [{ ...fixture.holdings[0], components: [{ holdingId: "x", name: "x", weight: 1.2, resolved: true }] }] }), /INVALID_LOOKTHROUGH_COMPONENT/);
  assert.throws(() => calculateEtfExposure({ ...fixture, holdings: [{ ...fixture.holdings[0], components: [] }] }), /LOOKTHROUGH_COMPONENTS_REQUIRED/);
});
