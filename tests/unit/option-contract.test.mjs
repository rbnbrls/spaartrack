import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateOptionContract, deriveOptionLifecycleStatus } from "../../apps/api/src/option-contract.ts";
import { calculateOptionGreeks } from "../../apps/api/src/option-greeks.ts";

const fixture = JSON.parse(readFileSync(new URL("../../fixtures/SPECIAL-001.json", import.meta.url), "utf8"));
const option = fixture.option;
const asOf = option.scenario.as_of;

function contractInput(overrides = {}) {
  return {
    optionType: option.contract.option_type,
    strikePrice: option.contract.strike_price,
    expiryAt: option.contract.expiry_at,
    contractMultiplier: option.contract.contract_multiplier,
    impliedVolatility: option.contract.implied_volatility,
    asOf,
    ...overrides
  };
}

function greeksInput(overrides = {}) {
  return {
    optionType: option.contract.option_type,
    strikePrice: option.contract.strike_price,
    spotPrice: option.scenario.spot_price,
    volatility: option.contract.implied_volatility,
    riskFreeRate: option.scenario.risk_free_rate,
    dividendYield: option.scenario.dividend_yield,
    asOf,
    expiryAt: option.contract.expiry_at,
    contractMultiplier: option.contract.contract_multiplier,
    ...overrides
  };
}

test("US-1404 unit: contract validation normalizes underlying fields, multiplier, IV and lifecycle status", () => {
  const validated = validateOptionContract(contractInput());
  assert.equal(validated.option_type, "CALL");
  assert.equal(validated.strike_price, "100.000000000000");
  assert.equal(validated.expiry_at, "2027-01-15T17:00:00.000Z");
  assert.equal(validated.contract_multiplier, "100.000000000000");
  assert.equal(validated.implied_volatility, "0.250000000000");
  assert.equal(validated.lifecycle_status, "ACTIVE");
  assert.equal(validated.lifecycle_source, "EXPIRY_SCHEDULE");
  assert.equal(validated.as_of, asOf);
  assert.equal(validated.calculation_version, "option-contract-v1");
  assert.equal(validated.read_only, true);

  const put = validateOptionContract(contractInput({ optionType: "put", impliedVolatility: undefined }));
  assert.equal(put.option_type, "PUT");
  assert.equal(put.implied_volatility, null);
  assert.equal(validateOptionContract(contractInput({ expiryAt: "2027-01-15" })).expiry_at, "2027-01-15T00:00:00.000Z");
});

test("US-1404 unit: invalid option contract combinations are rejected", () => {
  assert.throws(() => validateOptionContract(contractInput({ optionType: "STRADDLE" })), /INVALID_OPTION_CONTRACT/);
  assert.throws(() => validateOptionContract(contractInput({ strikePrice: 0 })), /INVALID_OPTION_CONTRACT/);
  assert.throws(() => validateOptionContract(contractInput({ strikePrice: -10 })), /INVALID_OPTION_CONTRACT/);
  assert.throws(() => validateOptionContract(contractInput({ strikePrice: "not-a-number" })), /INVALID_OPTION_CONTRACT/);
  assert.throws(() => validateOptionContract(contractInput({ expiryAt: "2027-13-15T17:00:00.000Z" })), /INVALID_OPTION_CONTRACT/);
  assert.throws(() => validateOptionContract(contractInput({ expiryAt: "not-a-date" })), /INVALID_OPTION_CONTRACT/);
  assert.throws(() => validateOptionContract(contractInput({ contractMultiplier: 0 })), /INVALID_OPTION_CONTRACT/);
  assert.throws(() => validateOptionContract(contractInput({ contractMultiplier: "abc" })), /INVALID_OPTION_CONTRACT/);
  assert.throws(() => validateOptionContract(contractInput({ impliedVolatility: 0 })), /INVALID_OPTION_CONTRACT/);
  assert.throws(() => validateOptionContract(contractInput({ impliedVolatility: -0.1 })), /INVALID_OPTION_CONTRACT/);
  assert.throws(() => validateOptionContract(contractInput({ impliedVolatility: 6 })), /INVALID_OPTION_CONTRACT/);
});

test("US-1404 unit: lifecycle status combines expiry schedule with terminal lifecycle events", () => {
  const base = { expiryAt: "2027-01-15T17:00:00.000Z" };
  const active = deriveOptionLifecycleStatus({ ...base, asOf: "2026-10-17T17:00:00.000Z" });
  assert.deepEqual(active, { status: "ACTIVE", source: "EXPIRY_SCHEDULE", as_of: "2026-10-17T17:00:00.000Z", expiry_at: "2027-01-15T17:00:00.000Z", terminal_event_type: null });

  const expired = deriveOptionLifecycleStatus({ ...base, asOf: "2027-01-15T17:00:00.000Z" });
  assert.equal(expired.status, "EXPIRED");
  assert.equal(expired.source, "EXPIRY_SCHEDULE");

  const closed = deriveOptionLifecycleStatus({
    ...base,
    asOf: "2027-02-01T00:00:00.000Z",
    lifecycleEvents: [
      { event_type: "OPEN", occurred_at: "2026-10-01T10:00:00.000Z" },
      { event_type: "PARTIAL_CLOSE", occurred_at: "2026-11-01T10:00:00.000Z" },
      { event_type: "CLOSE", occurred_at: "2026-12-01T10:00:00.000Z" }
    ]
  });
  assert.equal(closed.status, "CLOSED");
  assert.equal(closed.source, "LIFECYCLE_EVENT");
  assert.equal(closed.terminal_event_type, "CLOSE");

  const rolled = deriveOptionLifecycleStatus({
    ...base,
    asOf: "2027-02-01T00:00:00.000Z",
    lifecycleEvents: [
      { event_type: "CLOSE", occurred_at: "2026-12-01T10:00:00.000Z" },
      { event_type: "ROLL", occurred_at: "2026-12-15T10:00:00.000Z" }
    ]
  });
  assert.equal(rolled.status, "ROLLED");

  assert.equal(deriveOptionLifecycleStatus({ ...base, asOf: "2026-10-17T17:00:00.000Z", lifecycleEvents: [{ event_type: "OPEN", occurred_at: "2026-10-01T10:00:00.000Z" }] }).status, "ACTIVE");
  assert.equal(deriveOptionLifecycleStatus({ ...base, asOf: "2027-02-01T00:00:00.000Z", lifecycleEvents: [{ event_type: "ASSIGNMENT", occurred_at: "2027-01-10T10:00:00.000Z" }] }).status, "ASSIGNED");
  assert.equal(deriveOptionLifecycleStatus({ ...base, asOf: "2027-02-01T00:00:00.000Z", lifecycleEvents: [{ event_type: "EXERCISE", occurred_at: "2027-01-10T10:00:00.000Z" }] }).status, "EXERCISED");
  assert.equal(deriveOptionLifecycleStatus({ ...base, asOf: "2027-02-01T00:00:00.000Z", lifecycleEvents: [{ event_type: "EXPIRY", occurred_at: "2027-01-15T17:00:00.000Z" }] }).status, "EXPIRED");
});

test("US-1404 unit: CALL Greeks match the Black-Scholes-Merton golden fixture", () => {
  const greeks = calculateOptionGreeks(greeksInput());
  assert.equal(greeks.option_type, "CALL");
  assert.equal(greeks.spot_price, "105.000000000000");
  assert.equal(greeks.strike_price, "100.000000000000");
  assert.equal(greeks.contract_multiplier, "100.000000000000");
  assert.equal(greeks.time_to_expiry_years, option.expected.time_to_expiry_years);
  assert.equal(greeks.moneyness, option.expected.moneyness);
  assert.equal(greeks.theoretical_price, option.expected.theoretical_price);
  assert.equal(greeks.intrinsic_value, option.expected.intrinsic_value);
  assert.equal(greeks.time_value, option.expected.time_value);
  assert.equal(greeks.premium_value_per_contract, option.expected.premium_value_per_contract);
  assert.equal(greeks.delta, option.expected.delta);
  assert.equal(greeks.gamma, option.expected.gamma);
  assert.equal(greeks.theta, option.expected.theta);
  assert.equal(greeks.vega, option.expected.vega);
  assert.equal(greeks.rho, option.expected.rho);
  assert.equal(greeks.lifecycle_status, option.expected.lifecycle_status);
  assert.equal(greeks.calculation_version, "option-greeks-v1");
  assert.equal(greeks.source, "option_contract");
  assert.equal(greeks.read_only, true);
  assert.equal(greeks.assumptions.model, "BLACK_SCHOLES_MERTON");
  assert.equal(greeks.assumptions.volatility_input, "ANNUALIZED_DECIMAL");
  assert.equal(greeks.assumptions.day_count, "ACT_365");
  assert.equal(greeks.assumptions.theta_convention, "PER_YEAR");
  assert.equal(greeks.assumptions.vega_convention, "PER_VOL_UNIT");
  assert.equal(greeks.assumptions.rho_convention, "PER_RATE_UNIT");
  assert.equal(greeks.assumptions.european_exercise, true);
  assert.equal(greeks.implied_volatility, "0.250000000000");
});

test("US-1404 unit: PUT Greeks and put-call parity follow the same BSM assumptions", () => {
  const call = calculateOptionGreeks(greeksInput());
  const put = calculateOptionGreeks(greeksInput({ optionType: "PUT" }));
  assert.equal(put.theoretical_price, option.expected.put.theoretical_price);
  assert.equal(put.delta, option.expected.put.delta);
  assert.equal(put.gamma, option.expected.put.gamma);
  assert.equal(put.theta, option.expected.put.theta);
  assert.equal(put.vega, option.expected.put.vega);
  assert.equal(put.rho, option.expected.put.rho);
  assert.equal(put.intrinsic_value, "0.000000000000");
  assert.equal(put.moneyness, "OTM");

  const years = Number(call.time_to_expiry_years);
  const parity = Number(call.theoretical_price) - Number(put.theoretical_price) - (Number(call.spot_price) - Number(call.strike_price) * Math.exp(-option.scenario.risk_free_rate * years));
  assert.ok(Math.abs(parity) < 1e-9, `put-call parity residual ${parity} should be near zero`);

  const textbookCall = calculateOptionGreeks(greeksInput({ spotPrice: 100, strikePrice: 100, volatility: 0.2, riskFreeRate: 0.05, asOf: "2026-01-01T00:00:00.000Z", expiryAt: "2027-01-01T00:00:00.000Z", contractMultiplier: 1 }));
  const textbookPut = calculateOptionGreeks(greeksInput({ optionType: "PUT", spotPrice: 100, strikePrice: 100, volatility: 0.2, riskFreeRate: 0.05, asOf: "2026-01-01T00:00:00.000Z", expiryAt: "2027-01-01T00:00:00.000Z", contractMultiplier: 1 }));
  assert.ok(Math.abs(Number(textbookCall.theoretical_price) - 10.450583572185565) < 1e-9, `textbook call ${textbookCall.theoretical_price}`);
  assert.ok(Math.abs(Number(textbookPut.theoretical_price) - 5.573526022256971) < 1e-9, `textbook put ${textbookPut.theoretical_price}`);
  assert.ok(Math.abs(Number(textbookCall.delta) - 0.636830652) < 1e-9);
  assert.ok(Math.abs(Number(textbookCall.gamma) - 0.018762017) < 1e-9);
});

test("US-1404 unit: invalid greeks inputs and expired contracts are rejected", () => {
  assert.throws(() => calculateOptionGreeks(greeksInput({ volatility: undefined })), /INVALID_OPTION_GREEKS_INPUT/);
  assert.throws(() => calculateOptionGreeks(greeksInput({ volatility: 0 })), /INVALID_OPTION_GREEKS_INPUT/);
  assert.throws(() => calculateOptionGreeks(greeksInput({ volatility: 6 })), /INVALID_OPTION_GREEKS_INPUT/);
  assert.throws(() => calculateOptionGreeks(greeksInput({ spotPrice: 0 })), /INVALID_OPTION_GREEKS_INPUT/);
  assert.throws(() => calculateOptionGreeks(greeksInput({ spotPrice: "abc" })), /INVALID_OPTION_GREEKS_INPUT/);
  assert.throws(() => calculateOptionGreeks(greeksInput({ riskFreeRate: "abc" })), /INVALID_OPTION_GREEKS_INPUT/);
  assert.throws(() => calculateOptionGreeks(greeksInput({ asOf: "not-a-date" })), /INVALID_OPTION_GREEKS_INPUT/);
  assert.throws(() => calculateOptionGreeks(greeksInput({ asOf: "2027-01-15T17:00:00.000Z" })), /OPTION_EXPIRED/);
  assert.throws(() => calculateOptionGreeks(greeksInput({ asOf: "2027-02-01T00:00:00.000Z" })), /OPTION_EXPIRED/);
  assert.throws(() => calculateOptionGreeks(greeksInput({ contractMultiplier: 0 })), /INVALID_OPTION_GREEKS_INPUT/);
});
