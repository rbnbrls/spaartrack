import { fixtureKey } from "../helpers/fixture-key.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/bond-pricing.ts", root), "utf8");
const web = readWebSource();
const fixture = JSON.parse(readFileSync(new URL("fixtures/SPECIAL-001.json", root), "utf8"));

test("TC-US-1402: bond pricing kernel exposes versioned YTM, dirty price, accrued interest, duration, convexity and DV01", () => {
  for (const marker of ["calculateBondMetrics", "bond-pricing-v1", "yield_rate", "yield_source", "dirty_price", "clean_price", "accrued_interest", "macaulay_duration", "modified_duration", "convexity", "dv01", "periods_per_year", "assumptions", "read_only"]) assert.match(kernel, new RegExp(marker));
  for (const marker of ["ledger_transaction", "ledger_entry", "INSERT INTO spaartrack.ledger"]) assert.doesNotMatch(kernel, new RegExp(marker));
});

test("TC-US-1402: bond metrics boundary is authenticated, traceable and human-acceptance ready", () => {
  for (const marker of ["/api/v1/bond-metrics", "bondPricingRoute", "BOND_PRICING", "trace_id", "correlation_id"]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const marker of ["bond-pricing-panel", "bond-pricing-form", "bond-pricing-result", "bond-metrics-calculate", "bond-pricing-v1"]) assert.match(web, new RegExp(marker));
});

test("TC-US-1402-runtime: bond metrics endpoint is authenticated", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const base = process.env.API_URL || "http://localhost:18080";
  const response = await fetch(`${base}/api/v1/bond-metrics?instrument_id=00000000-0000-0000-0000-000000000000`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});

test("TC-US-1402-A runtime: yield mode prices the synthetic bond with versioned output", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = process.env.API_URL || "http://localhost:18080";
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-bond-metrics-${suffix}@example.test`, display_name: "Synthetic Bond Metrics" });
  const session = await create("/api/v1/test-fixtures/sessions", { email: user.email, ttl_seconds: 180 }, { "x-synthetic-fixture-key": fixtureKey() });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Bond Metrics ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const instrument = await create("/api/v1/instruments", { ...fixture.bond.instrument, ticker: `BM${String(Date.now()).slice(-6)}` }, auth);
  await create("/api/v1/bond-profiles", { portfolio_id: portfolio.id, instrument_id: instrument.id, ...fixture.bond.profile }, auth);

  const response = await fetch(`${base}/api/v1/bond-metrics?instrument_id=${instrument.id}&settlement_date=2026-10-17&yield_rate=0.03`, { headers: auth });
  assert.equal(response.status, 200);
  const metrics = await response.json();
  assert.equal(metrics.calculation_version, "bond-pricing-v1");
  assert.equal(metrics.read_only, true);
  assert.equal(metrics.source, "bond_profile");
  assert.equal(metrics.yield_source, "EXPLICIT_SCENARIO");
  assert.equal(metrics.yield_rate, "0.030000000000");
  assert.equal(metrics.dirty_price, "1054.987075754621");
  assert.equal(metrics.accrued_interest, "11.945205479452");
  assert.equal(metrics.clean_price, "1043.041870275169");
  assert.equal(metrics.macaulay_duration, "4.343313033826");
  assert.equal(metrics.modified_duration, "4.216808770705");
  assert.equal(metrics.convexity, "22.783469973054");
  assert.equal(metrics.dv01, "0.444867875402");
  assert.equal(metrics.periods_per_year, 1);
  assert.equal(metrics.assumptions.discount_year_fraction, "ACT_365");
  assert.ok(metrics.trace_id);
  assert.ok(metrics.correlation_id);

  const replayResponse = await fetch(`${base}/api/v1/ledger/replay`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ portfolio_id: portfolio.id }) });
  assert.equal(replayResponse.status, 200);
  const replay = await replayResponse.json();
  assert.equal(replay.transaction_count, 0);
});

test("TC-US-1402-B runtime: price mode solves YTM and validation failures are explicit", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = process.env.API_URL || "http://localhost:18080";
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-bond-solver-${suffix}@example.test`, display_name: "Synthetic Bond Solver" });
  const session = await create("/api/v1/test-fixtures/sessions", { email: user.email, ttl_seconds: 180 }, { "x-synthetic-fixture-key": fixtureKey() });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Bond Solver ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const instrument = await create("/api/v1/instruments", { ...fixture.bond.instrument, ticker: `BS${String(Date.now()).slice(-6)}` }, auth);
  await create("/api/v1/bond-profiles", { portfolio_id: portfolio.id, instrument_id: instrument.id, ...fixture.bond.profile }, auth);

  const solvedResponse = await fetch(`${base}/api/v1/bond-metrics?instrument_id=${instrument.id}&settlement_date=2026-10-17&dirty_price=1054.987075754621`, { headers: auth });
  assert.equal(solvedResponse.status, 200);
  const solved = await solvedResponse.json();
  assert.equal(solved.yield_source, "SOLVED_FROM_PRICE");
  assert.ok(Math.abs(Number(solved.yield_rate) - 0.03) < 1e-9, `solved ytm ${solved.yield_rate}`);
  assert.equal(solved.dirty_price, "1054.987075754621");
  assert.equal(solved.assumptions.solver, "bisection-v1");

  const bothResponse = await fetch(`${base}/api/v1/bond-metrics?instrument_id=${instrument.id}&settlement_date=2026-10-17&yield_rate=0.03&dirty_price=1000`, { headers: auth });
  assert.equal(bothResponse.status, 400);
  assert.equal((await bothResponse.json()).error, "INVALID_BOND_PRICING_INPUT");

  const rangeResponse = await fetch(`${base}/api/v1/bond-metrics?instrument_id=${instrument.id}&settlement_date=2026-06-29&yield_rate=0.03`, { headers: auth });
  assert.equal(rangeResponse.status, 400);
  assert.equal((await rangeResponse.json()).error, "SETTLEMENT_OUT_OF_RANGE");

  const missingResponse = await fetch(`${base}/api/v1/bond-metrics?instrument_id=00000000-0000-0000-0000-000000000000&settlement_date=2026-10-17&yield_rate=0.03`, { headers: auth });
  assert.equal(missingResponse.status, 404);
  assert.equal((await missingResponse.json()).error, "BOND_PROFILE_NOT_FOUND");
});
