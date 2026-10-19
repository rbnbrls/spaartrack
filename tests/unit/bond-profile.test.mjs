import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateBondProfile, generateBondCashflows } from "../../apps/api/src/bond-profile.ts";

const fixture = JSON.parse(readFileSync(new URL("../../fixtures/SPECIAL-001.json", import.meta.url), "utf8"));
const bondProfile = fixture.bond.profile;

function profileInput(overrides = {}) {
  return { ...bondProfile, ...overrides };
}

test("US-1401-A unit: synthetic bond profile from SPECIAL-001 validates issuer, coupon, frequency, maturity and currency", () => {
  const result = validateBondProfile(bondProfile);
  assert.equal(result.calculation_version, "bond-profile-v1");
  assert.equal(result.issuer_type, "GOVERNMENT");
  assert.equal(result.issuer_name, "Synthetic Treasury");
  assert.equal(result.coupon_rate, "0.040000000000");
  assert.equal(result.coupon_frequency, "ANNUAL");
  assert.equal(result.issue_date, "2026-06-30");
  assert.equal(result.maturity_date, "2031-06-30");
  assert.equal(result.face_value, "1000.000000000000");
  assert.equal(result.currency_code, "EUR");
  assert.equal(result.day_count_convention, "ACT_365");
});

test("US-1401-A unit: invalid issuer, frequency, maturity, currency or coupon is rejected", () => {
  assert.throws(() => validateBondProfile(profileInput({ issuer_type: "NGO" })), /INVALID_BOND_PROFILE/);
  assert.throws(() => validateBondProfile(profileInput({ issuer_name: "" })), /INVALID_BOND_PROFILE/);
  assert.throws(() => validateBondProfile(profileInput({ coupon_frequency: "WEEKLY" })), /INVALID_BOND_PROFILE/);
  assert.throws(() => validateBondProfile(profileInput({ issue_date: "2031-06-30", maturity_date: "2026-06-30" })), /INVALID_BOND_PROFILE/);
  assert.throws(() => validateBondProfile(profileInput({ currency_code: "EURO" })), /INVALID_BOND_PROFILE/);
  assert.throws(() => validateBondProfile(profileInput({ coupon_rate: 1.5 })), /INVALID_BOND_PROFILE/);
  assert.throws(() => validateBondProfile(profileInput({ face_value: 0 })), /INVALID_BOND_PROFILE/);
});

test("US-1401-B unit: annual coupon schedule yields dated coupon and principal cashflows", () => {
  const result = generateBondCashflows(bondProfile);
  assert.equal(result.calculation_version, "bond-cashflow-v1");
  assert.equal(result.read_only, true);
  assert.equal(result.source, "bond_profile");
  assert.equal(result.cashflows.length, fixture.bond.expected.coupons + fixture.bond.expected.principal_payments);
  assert.equal(result.cashflows[0].payment_date, fixture.bond.expected.first_coupon_date);
  assert.equal(result.cashflows[0].cashflow_type, "COUPON");
  assert.equal(result.cashflows[0].amount, fixture.bond.expected.coupon_amount);
  const principal = result.cashflows.filter((flow) => flow.cashflow_type === "PRINCIPAL");
  assert.equal(principal.length, 1);
  assert.equal(principal[0].payment_date, fixture.bond.expected.maturity_date);
  assert.equal(principal[0].amount, fixture.bond.expected.principal_amount);
  const finalCoupon = result.cashflows.filter((flow) => flow.cashflow_type === "COUPON").at(-1);
  assert.equal(finalCoupon?.payment_date, fixture.bond.expected.final_coupon_date);
  assert.equal(result.totals.coupon_total, fixture.bond.expected.coupon_total);
  assert.equal(result.totals.principal_total, fixture.bond.expected.principal_amount);
});

test("US-1401-B unit: semi-annual and monthly frequencies generate the expected dated schedule", () => {
  const semi = generateBondCashflows(profileInput({ coupon_frequency: "SEMI_ANNUAL", issue_date: "2026-07-01", maturity_date: "2029-07-01" }));
  const semiCoupons = semi.cashflows.filter((flow) => flow.cashflow_type === "COUPON");
  assert.equal(semiCoupons.length, 6);
  assert.equal(semiCoupons[0].payment_date, "2027-01-01");
  assert.equal(semiCoupons[0].amount, "20.000000000000");

  const monthly = generateBondCashflows(profileInput({ coupon_frequency: "MONTHLY", issue_date: "2026-03-15", maturity_date: "2026-09-15" }));
  const monthlyCoupons = monthly.cashflows.filter((flow) => flow.cashflow_type === "COUPON");
  assert.equal(monthlyCoupons.length, 6);
  for (const coupon of monthlyCoupons) assert.equal(coupon.amount, (1000 * 0.04 / 12).toFixed(12));
});

test("US-1401-B unit: at-maturity frequency pays a single coupon with principal on the maturity date", () => {
  const result = generateBondCashflows(profileInput({ coupon_frequency: "AT_MATURITY" }));
  assert.equal(result.cashflows.length, 2);
  assert.equal(result.cashflows[0].payment_date, "2031-06-30");
  assert.equal(result.cashflows[0].cashflow_type, "COUPON");
  assert.equal(result.cashflows[0].amount, "40.000000000000");
  assert.equal(result.cashflows[1].cashflow_type, "PRINCIPAL");
  assert.equal(result.totals.coupon_total, "40.000000000000");
});

test("US-1401-B unit: invalid profile input is rejected before the schedule is generated", () => {
  assert.throws(() => generateBondCashflows(profileInput({ coupon_rate: -0.01 })), /INVALID_BOND_PROFILE/);
  assert.throws(() => generateBondCashflows(profileInput({ maturity_date: "not-a-date" })), /INVALID_BOND_PROFILE/);
});
