import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const contractKernel = readFileSync(new URL("apps/api/src/option-contract.ts", root), "utf8");
const greeksKernel = readFileSync(new URL("apps/api/src/option-greeks.ts", root), "utf8");
const web = readFileSync(new URL("apps/web/index.html", root), "utf8");
const fixture = JSON.parse(readFileSync(new URL("fixtures/SPECIAL-001.json", root), "utf8"));

test("TC-US-1404: synthetic SPECIAL-001 option fixture carries contract, scenario and golden Greeks", () => {
  assert.equal(fixture.fixture_id, "SPECIAL-001");
  assert.equal(fixture.option.contract.option_type, "CALL");
  assert.equal(fixture.option.instrument.instrument_type, "OPTION");
  assert.equal(fixture.option.instrument.asset_class, "DERIVATIVE");
  assert.equal(fixture.option.contract.contract_multiplier, 100);
  assert.equal(fixture.option.contract.implied_volatility, 0.25);
  assert.equal(fixture.option.expected.delta, "0.689635720946");
  assert.equal(fixture.option.expected.lifecycle_status, "ACTIVE");
});

test("TC-US-1404: option kernels expose lifecycle status and versioned BSM Greeks without touching the ledger", () => {
  for (const marker of ["validateOptionContract", "deriveOptionLifecycleStatus", "option-contract-v1", "lifecycle_status", "contract_multiplier", "implied_volatility", "read_only"]) assert.match(contractKernel, new RegExp(marker));
  for (const marker of ["calculateOptionGreeks", "option-greeks-v1", "BLACK_SCHOLES_MERTON", "delta", "gamma", "theta", "vega", "rho", "moneyness", "assumptions", "read_only"]) assert.match(greeksKernel, new RegExp(marker));
  for (const kernel of [contractKernel, greeksKernel]) {
    for (const marker of ["ledger_transaction", "ledger_entry", "INSERT INTO spaartrack.ledger"]) assert.doesNotMatch(kernel, new RegExp(marker));
  }
});

test("TC-US-1404: option contract boundary is authenticated, traceable and human-acceptance ready", () => {
  for (const marker of ["/api/v1/option-contracts", "/api/v1/option-greeks", "optionContractRoute", "optionGreeksRoute", "OPTION_CONTRACT", "OPTION_GREEKS", "OPTION_CONTRACT_ALREADY_EXISTS", "OPTION_CONTRACT_NOT_FOUND", "INVALID_OPTION_CONTRACT", "trace_id", "correlation_id"]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const marker of ["option-contract-panel", "option-contract-form", "prepare-option-contract", "option-greeks-calculate", "option-greeks-result", "option-greeks-evidence", "option-contract-v1", "option-greeks-v1"]) assert.match(web, new RegExp(marker));
});

test("TC-US-1404-runtime: option contract endpoint is authenticated", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const base = process.env.API_URL || "http://localhost:18080";
  const response = await fetch(`${base}/api/v1/option-contracts`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});

test("TC-US-1404-runtime: synthetic option contract is registered, managed and ledger-neutral", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = process.env.API_URL || "http://localhost:18080";
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-option-${suffix}@example.test`, display_name: "Synthetic Option User" });
  const session = await create("/api/v1/sessions", { email: user.email, ttl_seconds: 180 });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Options ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const underlying = await create("/api/v1/instruments", { ...fixture.option.underlying, ticker: `EQS${String(Date.now()).slice(-6)}` }, auth);
  const instrument = await create("/api/v1/instruments", { ...fixture.option.instrument, ticker: `OS${String(Date.now()).slice(-6)}` }, auth);

  const created = await create("/api/v1/option-contracts", {
    portfolio_id: portfolio.id,
    instrument_id: instrument.id,
    underlying_instrument_id: underlying.id,
    ...fixture.option.contract
  }, auth);
  assert.equal(created.calculation_version, "option-contract-v1");
  assert.equal(created.option_type, "CALL");
  assert.equal(created.strike_price, "100.000000000000");
  assert.equal(created.expiry_at, fixture.option.contract.expiry_at);
  assert.equal(created.contract_multiplier, "100.000000000000");
  assert.equal(created.implied_volatility, "0.250000000000");
  assert.equal(created.lifecycle_status, "ACTIVE");
  assert.equal(created.read_only, true);
  assert.ok(created.trace_id);
  assert.ok(created.correlation_id);

  const duplicateResponse = await fetch(`${base}/api/v1/option-contracts`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ portfolio_id: portfolio.id, instrument_id: instrument.id, underlying_instrument_id: underlying.id, ...fixture.option.contract }) });
  assert.equal(duplicateResponse.status, 409);
  assert.equal((await duplicateResponse.json()).error, "OPTION_CONTRACT_ALREADY_EXISTS");

  const invalidResponse = await fetch(`${base}/api/v1/option-contracts`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ portfolio_id: portfolio.id, instrument_id: instrument.id, underlying_instrument_id: underlying.id, ...fixture.option.contract, strike_price: 0 }) });
  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).error, "INVALID_OPTION_CONTRACT");

  const readBackResponse = await fetch(`${base}/api/v1/option-contracts/${instrument.id}`, { headers: auth });
  assert.equal(readBackResponse.status, 200);
  const readBack = await readBackResponse.json();
  assert.equal(readBack.underlying_instrument_id, underlying.id);
  assert.equal(readBack.lifecycle_status, "ACTIVE");
  assert.equal(readBack.lifecycle_source, "EXPIRY_SCHEDULE");

  const listResponse = await fetch(`${base}/api/v1/option-contracts`, { headers: auth });
  assert.equal(listResponse.status, 200);
  const listed = await listResponse.json();
  assert.ok(listed.contracts.some((entry) => entry.instrument_id === instrument.id));

  const replayResponse = await fetch(`${base}/api/v1/ledger/replay`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ portfolio_id: portfolio.id }) });
  assert.equal(replayResponse.status, 200);
  const replay = await replayResponse.json();
  assert.equal(replay.transaction_count, 0);
});

test("TC-US-1404-runtime: Greeks are computed from the managed contract with golden values", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = process.env.API_URL || "http://localhost:18080";
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-option-greeks-${suffix}@example.test`, display_name: "Synthetic Option Greeks" });
  const session = await create("/api/v1/sessions", { email: user.email, ttl_seconds: 180 });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Greeks ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const underlying = await create("/api/v1/instruments", { ...fixture.option.underlying, ticker: `EQG${String(Date.now()).slice(-6)}` }, auth);
  const instrument = await create("/api/v1/instruments", { ...fixture.option.instrument, ticker: `OG${String(Date.now()).slice(-6)}` }, auth);
  await create("/api/v1/option-contracts", { portfolio_id: portfolio.id, instrument_id: instrument.id, underlying_instrument_id: underlying.id, ...fixture.option.contract }, auth);

  const scenario = fixture.option.scenario;
  const query = new URLSearchParams({
    instrument_id: instrument.id,
    as_of: scenario.as_of,
    spot_price: String(scenario.spot_price),
    risk_free_rate: String(scenario.risk_free_rate),
    dividend_yield: String(scenario.dividend_yield)
  });
  const greeksResponse = await fetch(`${base}/api/v1/option-greeks?${query}`, { headers: auth });
  assert.equal(greeksResponse.status, 200);
  const greeks = await greeksResponse.json();
  const expected = fixture.option.expected;
  assert.equal(greeks.calculation_version, "option-greeks-v1");
  assert.equal(greeks.read_only, true);
  assert.equal(greeks.source, "option_contract");
  assert.equal(greeks.implied_volatility, "0.250000000000");
  assert.equal(greeks.time_to_expiry_years, expected.time_to_expiry_years);
  assert.equal(greeks.moneyness, expected.moneyness);
  assert.equal(greeks.theoretical_price, expected.theoretical_price);
  assert.equal(greeks.intrinsic_value, expected.intrinsic_value);
  assert.equal(greeks.time_value, expected.time_value);
  assert.equal(greeks.premium_value_per_contract, expected.premium_value_per_contract);
  assert.equal(greeks.delta, expected.delta);
  assert.equal(greeks.gamma, expected.gamma);
  assert.equal(greeks.theta, expected.theta);
  assert.equal(greeks.vega, expected.vega);
  assert.equal(greeks.rho, expected.rho);
  assert.equal(greeks.lifecycle_status, "ACTIVE");
  assert.equal(greeks.assumptions.model, "BLACK_SCHOLES_MERTON");
  assert.ok(greeks.trace_id);
  assert.ok(greeks.correlation_id);

  const persistResponse = await fetch(`${base}/api/v1/option-contracts/${instrument.id}`, { headers: auth });
  assert.equal(persistResponse.status, 200);
  const persisted = await persistResponse.json();
  assert.equal(Number(persisted.greeks.delta).toFixed(9), Number(expected.delta).toFixed(9));
  assert.equal(Number(persisted.greeks.vega).toFixed(9), Number(expected.vega).toFixed(9));
  assert.equal(persisted.implied_volatility, "0.250000000000");

  const putQuery = new URLSearchParams({ ...Object.fromEntries(query), option_type: "PUT" });
  const putResponse = await fetch(`${base}/api/v1/option-greeks?${putQuery}`, { headers: auth });
  assert.equal(putResponse.status, 200);
  const put = await putResponse.json();
  assert.equal(put.theoretical_price, expected.put.theoretical_price);
  assert.equal(put.delta, expected.put.delta);
  assert.equal(put.theta, expected.put.theta);

  const expiredResponse = await fetch(`${base}/api/v1/option-greeks?instrument_id=${instrument.id}&as_of=2027-02-01T00:00:00.000Z&spot_price=105&risk_free_rate=0.02`, { headers: auth });
  assert.equal(expiredResponse.status, 400);
  assert.equal((await expiredResponse.json()).error, "OPTION_EXPIRED");

  const missingResponse = await fetch(`${base}/api/v1/option-greeks?instrument_id=00000000-0000-0000-0000-000000000000&as_of=${scenario.as_of}&spot_price=105&risk_free_rate=0.02`, { headers: auth });
  assert.equal(missingResponse.status, 404);
  assert.equal((await missingResponse.json()).error, "OPTION_CONTRACT_NOT_FOUND");
});

test("TC-US-1404-runtime: option contract registration outside the portfolio is forbidden", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = process.env.API_URL || "http://localhost:18080";
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const owner = await create("/api/v1/users", { email: `synthetic-option-owner-${suffix}@example.test`, display_name: "Synthetic Option Owner" });
  const ownerSession = await create("/api/v1/sessions", { email: owner.email, ttl_seconds: 120 });
  const ownerAuth = { authorization: `Bearer ${ownerSession.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Option Isolated ${suffix}`, reporting_currency_code: "EUR" }, ownerAuth);
  const underlying = await create("/api/v1/instruments", { ...fixture.option.underlying, ticker: `EQO${String(Date.now()).slice(-6)}` }, ownerAuth);
  const instrument = await create("/api/v1/instruments", { ...fixture.option.instrument, ticker: `OO${String(Date.now()).slice(-6)}` }, ownerAuth);

  const outsider = await create("/api/v1/users", { email: `synthetic-option-outsider-${suffix}@example.test`, display_name: "Synthetic Option Outsider" });
  const outsiderSession = await create("/api/v1/sessions", { email: outsider.email, ttl_seconds: 120 });
  const outsiderAuth = { authorization: `Bearer ${outsiderSession.token}` };
  const response = await fetch(`${base}/api/v1/option-contracts`, { method: "POST", headers: { "content-type": "application/json", ...outsiderAuth }, body: JSON.stringify({ portfolio_id: portfolio.id, instrument_id: instrument.id, underlying_instrument_id: underlying.id, ...fixture.option.contract }) });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "OPTION_CONTRACT_FORBIDDEN");
});
