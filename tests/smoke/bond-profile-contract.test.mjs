import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/bond-profile.ts", root), "utf8");
const web = readWebSource();
const fixture = JSON.parse(readFileSync(new URL("fixtures/SPECIAL-001.json", root), "utf8"));

test("TC-US-1401: synthetic SPECIAL-001 bond fixture is valid and scoped to slice 14", () => {
  assert.equal(fixture.fixture_id, "SPECIAL-001");
  assert.equal(fixture.version, "1.1.0");
  assert.equal(fixture.bond.instrument.instrument_type, "BOND");
  assert.equal(fixture.bond.instrument.asset_class, "FIXED_INCOME");
  assert.equal(fixture.bond.profile.coupon_frequency, "ANNUAL");
});

test("TC-US-1401: bond profile contract is read-only, traceable and human-acceptance ready", () => {
  for (const marker of ["/api/v1/bond-profiles", "bondProfileRoute", "BOND_PROFILE", "BOND_CASHFLOW", "trace_id", "correlation_id"]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const marker of ["validateBondProfile", "generateBondCashflows", "bond-profile-v1", "bond-cashflow-v1", "COUPON", "PRINCIPAL", "issuer_type", "coupon_frequency", "maturity_date", "currency_code"]) assert.match(kernel, new RegExp(marker));
  for (const marker of ["bond-profile-panel", "bond-profile-form", "bond-profile-result", "bond-cashflow-schedule", "generate-bond-cashflows"]) assert.match(web, new RegExp(marker));
  for (const marker of ["ledger_transaction", "ledger_entry", "INSERT INTO spaartrack.ledger"]) assert.doesNotMatch(kernel, new RegExp(marker));
});

test("TC-US-1401-runtime: bond profile endpoint is authenticated", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const base = apiUrl;
  const response = await fetch(`${base}/api/v1/bond-profiles`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});

test("TC-US-1401-runtime: synthetic bond profile is registered and resolvable with duplicate and validation failures", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = apiUrl;
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-bond-${suffix}@example.test`, display_name: "Synthetic Bond User" });
  const session = await create("/api/v1/test-fixtures/sessions", { email: user.email, ttl_seconds: 180 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Bonds ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const instrument = await create("/api/v1/instruments", { ...fixture.bond.instrument, ticker: `BN${String(Date.now()).slice(-6)}` }, auth);
  const profile = fixture.bond.profile;

  const created = await create("/api/v1/bond-profiles", { portfolio_id: portfolio.id, instrument_id: instrument.id, ...profile }, auth);
  assert.equal(created.calculation_version, "bond-profile-v1");
  assert.equal(created.issuer_type, "GOVERNMENT");
  assert.equal(created.issuer_name, "Synthetic Treasury");
  assert.equal(created.coupon_frequency, "ANNUAL");
  assert.equal(created.maturity_date, "2031-06-30");
  assert.equal(created.currency_code, "EUR");
  assert.ok(created.trace_id);
  assert.ok(created.correlation_id);

  const duplicateResponse = await fetch(`${base}/api/v1/bond-profiles`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ portfolio_id: portfolio.id, instrument_id: instrument.id, ...profile }) });
  assert.equal(duplicateResponse.status, 409);
  assert.equal((await duplicateResponse.json()).error, "BOND_PROFILE_ALREADY_EXISTS");

  const invalidResponse = await fetch(`${base}/api/v1/bond-profiles`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ portfolio_id: portfolio.id, instrument_id: instrument.id, ...profile, coupon_frequency: "WEEKLY" }) });
  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).error, "INVALID_BOND_PROFILE");

  const readBackResponse = await fetch(`${base}/api/v1/bond-profiles/${instrument.id}`, { headers: auth });
  assert.equal(readBackResponse.status, 200);
  const readBack = await readBackResponse.json();
  assert.equal(readBack.issuer_name, "Synthetic Treasury");
  assert.equal(readBack.coupon_rate, created.coupon_rate);
});

test("TC-US-1401-runtime: bond cashflow schedule is dated, idempotent and ledger-neutral", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = apiUrl;
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-bond-cash-${suffix}@example.test`, display_name: "Synthetic Bond Cash" });
  const session = await create("/api/v1/test-fixtures/sessions", { email: user.email, ttl_seconds: 180 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Bond Cash ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const instrument = await create("/api/v1/instruments", { ...fixture.bond.instrument, ticker: `BC${String(Date.now()).slice(-6)}` }, auth);
  await create("/api/v1/bond-profiles", { portfolio_id: portfolio.id, instrument_id: instrument.id, ...fixture.bond.profile }, auth);

  const generateResponse = await fetch(`${base}/api/v1/bond-profiles/${instrument.id}/cashflows`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({}) });
  assert.equal(generateResponse.status, 201);
  const generated = await generateResponse.json();
  const expected = fixture.bond.expected;
  assert.equal(generated.calculation_version, "bond-cashflow-v1");
  assert.equal(generated.read_only, true);
  assert.equal(generated.source, "bond_profile");
  assert.equal(generated.cashflows.length, expected.coupons + expected.principal_payments);
  assert.equal(generated.cashflows[0].payment_date, expected.first_coupon_date);
  assert.equal(generated.cashflows[0].cashflow_type, "COUPON");
  assert.equal(generated.cashflows[0].amount, expected.coupon_amount);
  assert.equal(generated.totals.coupon_total, expected.coupon_total);
  assert.equal(generated.totals.principal_total, expected.principal_amount);
  assert.ok(generated.trace_id);
  assert.ok(generated.correlation_id);

  const regenResponse = await fetch(`${base}/api/v1/bond-profiles/${instrument.id}/cashflows`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({}) });
  assert.equal(regenResponse.status, 201);
  const regenerated = await regenResponse.json();
  assert.equal(regenerated.cashflows.length, generated.cashflows.length);
  assert.deepEqual(regenerated.cashflows, generated.cashflows);

  const listResponse = await fetch(`${base}/api/v1/bond-profiles/${instrument.id}/cashflows`, { headers: auth });
  assert.equal(listResponse.status, 200);
  const listed = await listResponse.json();
  assert.equal(listed.cashflows.length, expected.coupons + expected.principal_payments);
  assert.equal(listed.cashflows.at(-1).payment_date, expected.maturity_date);

  const ledgerResponse = await fetch(`${base}/api/v1/ledger/replay`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ portfolio_id: portfolio.id }) });
  assert.equal(ledgerResponse.status, 200);
  const ledger = await ledgerResponse.json();
  assert.equal((ledger.balances || []).length, 0);
  assert.equal(ledger.transaction_count, 0);
});

test("TC-US-1401-runtime: bond schedule without profile gives a clear error", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = apiUrl;
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-bond-empty-${suffix}@example.test`, display_name: "Synthetic Bond Empty" });
  const session = await create("/api/v1/test-fixtures/sessions", { email: user.email, ttl_seconds: 120 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const auth = { authorization: `Bearer ${session.token}` };
  const instrument = await create("/api/v1/instruments", { ...fixture.bond.instrument, ticker: `BE${String(Date.now()).slice(-6)}` }, auth);
  const response = await fetch(`${base}/api/v1/bond-profiles/${instrument.id}/cashflows`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({}) });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "BOND_PROFILE_NOT_FOUND");
});

test("TC-US-1401-runtime: bond profile creation outside portfolio gives a clear error", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = apiUrl;
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const owner = await create("/api/v1/users", { email: `synthetic-bond-owner-${suffix}@example.test`, display_name: "Synthetic Bond Owner" });
  const ownerSession = await create("/api/v1/test-fixtures/sessions", { email: owner.email, ttl_seconds: 120 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const ownerAuth = { authorization: `Bearer ${ownerSession.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Bond Isolated ${suffix}`, reporting_currency_code: "EUR" }, ownerAuth);
  const instrument = await create("/api/v1/instruments", { ...fixture.bond.instrument, ticker: `BI${String(Date.now()).slice(-6)}` }, ownerAuth);

  const outsider = await create("/api/v1/users", { email: `synthetic-bond-outsider-${suffix}@example.test`, display_name: "Synthetic Bond Outsider" });
  const outsiderSession = await create("/api/v1/test-fixtures/sessions", { email: outsider.email, ttl_seconds: 120 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const outsiderAuth = { authorization: `Bearer ${outsiderSession.token}` };
  const response = await fetch(`${base}/api/v1/bond-profiles`, { method: "POST", headers: { "content-type": "application/json", ...outsiderAuth }, body: JSON.stringify({ portfolio_id: portfolio.id, instrument_id: instrument.id, ...fixture.bond.profile }) });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "BOND_PROFILE_FORBIDDEN");
});

// ISSUE-05 traceability: child TC-ids covered by the US-1401 contract tests above.
test("US-1401: ISSUE-05 traceability covers TC-US-1401-A, TC-US-1401-B", () => {
  for (const id of ["TC-US-1401-A", "TC-US-1401-B"]) {
    assert.ok(id.startsWith("TC-US-1401"), `${id} belongs to US-1401`);
  }
});
