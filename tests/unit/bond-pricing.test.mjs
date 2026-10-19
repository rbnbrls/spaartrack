import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateBondMetrics } from "../../apps/api/src/bond-pricing.ts";

const fixture = JSON.parse(readFileSync(new URL("../../fixtures/SPECIAL-001.json", import.meta.url), "utf8"));
const bondProfile = fixture.bond.profile;
const settlement = "2026-10-17";

function metricsInput(overrides = {}) {
  return { profile: bondProfile, settlementDate: settlement, yieldRate: 0.03, ...overrides };
}

test("US-1402-A unit: explicit yield produces versioned dirty price, accrued interest and clean price", () => {
  const result = calculateBondMetrics(metricsInput());
  assert.equal(result.calculation_version, "bond-pricing-v1");
  assert.equal(result.read_only, true);
  assert.equal(result.source, "bond_profile");
  assert.equal(result.settlement_date, settlement);
  assert.equal(result.yield_source, "EXPLICIT_SCENARIO");
  assert.equal(result.yield_rate, "0.030000000000");
  assert.equal(result.dirty_price, "1054.987075754621");
  assert.equal(result.accrued_interest, "11.945205479452");
  assert.equal(result.clean_price, "1043.041870275169");
  assert.equal(result.currency_code, "EUR");
  assert.equal(result.periods_per_year, 1);
  assert.equal(result.assumptions.discount_year_fraction, "ACT_365");
  assert.equal(result.assumptions.compounding, "PERIODIC");
  assert.equal(result.assumptions.accrual_day_count, "ACT_365");
});

test("US-1402-A unit: given a dirty price the solver returns the versioned yield to maturity", () => {
  const priced = calculateBondMetrics(metricsInput());
  const solved = calculateBondMetrics(metricsInput({ yieldRate: undefined, dirtyPrice: priced.dirty_price }));
  assert.equal(solved.yield_source, "SOLVED_FROM_PRICE");
  assert.equal(solved.assumptions.solver, "bisection-v1");
  assert.ok(Math.abs(Number(solved.yield_rate) - 0.03) < 1e-9, `solved ytm ${solved.yield_rate} should reproduce 0.03`);
  assert.equal(solved.dirty_price, priced.dirty_price);
  assert.equal(solved.accrued_interest, priced.accrued_interest);
  assert.equal(solved.calculation_version, "bond-pricing-v1");
});

test("US-1402-B unit: duration, convexity and DV01 derive from the same resolved yield", () => {
  const result = calculateBondMetrics(metricsInput());
  const yieldRate = Number(result.yield_rate);
  const periods = result.periods_per_year;
  assert.equal(result.macaulay_duration, "4.343313033826");
  assert.equal(result.modified_duration, "4.216808770705");
  assert.equal(result.convexity, "22.783469973054");
  assert.equal(result.dv01, "0.444867875402");
  assert.ok(Math.abs(Number(result.modified_duration) - Number(result.macaulay_duration) / (1 + yieldRate / periods)) < 1e-12);
  assert.ok(Math.abs(Number(result.dv01) - Number(result.modified_duration) * Number(result.dirty_price) * 0.0001) < 1e-12);
  const bumped = calculateBondMetrics(metricsInput({ yieldRate: yieldRate + 0.0001 }));
  const firstOrderChange = -Number(result.dv01);
  const actualChange = Number(bumped.dirty_price) - Number(result.dirty_price);
  assert.ok(Math.abs(actualChange - firstOrderChange) < 0.001, `+1bp change ${actualChange} should track -DV01 ${firstOrderChange}`);
});

test("US-1402-B unit: at-maturity zero-coupon schedule has closed-form metrics", () => {
  const result = calculateBondMetrics(metricsInput({ profile: { ...bondProfile, coupon_frequency: "AT_MATURITY" }, settlementDate: "2026-06-30" }));
  assert.equal(result.dirty_price, "897.040487770325");
  assert.equal(result.macaulay_duration, "5.002739726027");
  assert.equal(result.modified_duration, "4.857028860221");
  assert.equal(result.convexity, "28.306291349232");
  assert.equal(result.dv01, "0.435695153789");
  assert.equal(result.accrued_interest, "0.000000000000");
  assert.equal(result.clean_price, result.dirty_price);
});

test("US-1402-B unit: accrued interest follows the profile day-count convention", () => {
  assert.equal(calculateBondMetrics(metricsInput()).accrued_interest, "11.945205479452");
  assert.equal(calculateBondMetrics(metricsInput({ profile: { ...bondProfile, day_count_convention: "THIRTY_360" } })).accrued_interest, "11.888888888889");
  assert.equal(calculateBondMetrics(metricsInput({ profile: { ...bondProfile, day_count_convention: "ACT_ACT" } })).accrued_interest, "11.945205479452");
});

test("US-1402 unit: invalid input combinations, dates and settlement range are rejected", () => {
  assert.throws(() => calculateBondMetrics(metricsInput({ yieldRate: 0.03, dirtyPrice: 1050 })), /INVALID_BOND_PRICING_INPUT/);
  assert.throws(() => calculateBondMetrics(metricsInput({ yieldRate: undefined, dirtyPrice: undefined })), /INVALID_BOND_PRICING_INPUT/);
  assert.throws(() => calculateBondMetrics(metricsInput({ yieldRate: -1 })), /INVALID_BOND_YIELD/);
  assert.throws(() => calculateBondMetrics(metricsInput({ yieldRate: 101 })), /INVALID_BOND_YIELD/);
  assert.throws(() => calculateBondMetrics(metricsInput({ dirtyPrice: 0 })), /INVALID_BOND_PRICE/);
  assert.throws(() => calculateBondMetrics(metricsInput({ dirtyPrice: "not-a-price" })), /INVALID_BOND_PRICE/);
  assert.throws(() => calculateBondMetrics(metricsInput({ settlementDate: "2026-13-01" })), /INVALID_BOND_PRICING_INPUT/);
  assert.throws(() => calculateBondMetrics(metricsInput({ settlementDate: "2026-06-29" })), /SETTLEMENT_OUT_OF_RANGE/);
  assert.throws(() => calculateBondMetrics(metricsInput({ settlementDate: "2031-06-30" })), /SETTLEMENT_OUT_OF_RANGE/);
  assert.throws(() => calculateBondMetrics(metricsInput({ profile: { ...bondProfile, coupon_frequency: "WEEKLY" } })), /INVALID_BOND_PROFILE/);
});
