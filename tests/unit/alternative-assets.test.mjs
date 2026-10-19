import test from "node:test";
import assert from "node:assert/strict";
import { describeAlternativeAssetValuation } from "../../apps/api/src/alternative-assets.ts";

test("US-1407 unit: crypto valuation is explicit about type, source and currency", () => {
  const valuation = describeAlternativeAssetValuation({
    instrument_type: "CRYPTO",
    asset_class: "CRYPTO",
    currency_code: "EUR",
    valuation_source: "PROVIDER",
    manual_price: null,
    provider_price: "67250.10"
  });
  assert.equal(valuation.instrument_type, "CRYPTO");
  assert.equal(valuation.valuation_source, "PROVIDER");
  assert.equal(valuation.effective_price, "67250.100000000000");
  assert.equal(valuation.price_origin, "provider");
  assert.equal(valuation.calculation_version, "alternative-asset-valuation-v1");
  assert.equal(valuation.read_only, true);
});

test("US-1407 unit: manual custom asset uses manual price explicitly", () => {
  const valuation = describeAlternativeAssetValuation({
    instrument_type: "CUSTOM",
    asset_class: "REAL_ASSET",
    currency_code: "EUR",
    valuation_source: "MANUAL",
    manual_price: "12500",
    provider_price: null
  });
  assert.equal(valuation.effective_price, "12500.000000000000");
  assert.equal(valuation.price_origin, "manual");
});

test("US-1407 unit: mismatched type and class is rejected", () => {
  assert.throws(() => describeAlternativeAssetValuation({
    instrument_type: "CRYPTO",
    asset_class: "EQUITY",
    currency_code: "EUR",
    valuation_source: "MANUAL",
    manual_price: "10",
    provider_price: null
  }), /INVALID_ALTERNATIVE_ASSET/);
});

test("US-1407 unit: missing price for manual valuation is rejected", () => {
  assert.throws(() => describeAlternativeAssetValuation({
    instrument_type: "FUTURE",
    asset_class: "DERIVATIVE",
    currency_code: "USD",
    valuation_source: "MANUAL",
    manual_price: null,
    provider_price: null
  }), /INVALID_ALTERNATIVE_ASSET/);
});
