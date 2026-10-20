import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const fixture = JSON.parse(readFileSync(new URL("fixtures/PERF-001.json", root), "utf8"));
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0701: income events separate received dividends from expected dividends by status", () => {
  for (const value of [
    "/api/v1/income-events", "income_event", "INCOME_EVENT", "incomeEventRoute",
    "ANNOUNCED", "PROJECTED", "EX_DATE", "PAID", "received", "expected"
  ]) assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const value of ["dividend-panel", "dividend-received", "dividend-expected", "Ontvangen dividends", "Verwachte dividends"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-0701-fixture: PERF-001 covers the four dividend statuses", () => {
  assert.equal(fixture.fixture_id, "PERF-001");
  const statuses = fixture.income_events.map((event) => event.status).sort();
  assert.deepEqual(statuses, ["ANNOUNCED", "EX_DATE", "PAID", "PROJECTED"]);
  assert.deepEqual(fixture.expected.received_statuses, ["PAID"]);
  assert.deepEqual(fixture.expected.expected_statuses, ["ANNOUNCED", "PROJECTED", "EX_DATE"]);
  assert.equal(fixture.expected.counts.received, 1);
  assert.equal(fixture.expected.counts.expected, 3);
});

test("TC-US-0701-runtime: received and expected dividends stay separated across status transitions", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-income-0701-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic income owner" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Income ${suffix}`, reporting_currency_code: "EUR", privacy_scope: "PRIVATE" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const instrumentResponse = await fetch(`${api}/api/v1/instruments`, { method: "POST", headers: auth, body: JSON.stringify({ ...fixture.instrument, ticker: `DIV${suffix.replace(/[^0-9]/g, "").slice(-5)}`, isin: `SYN${suffix.replace(/[^0-9]/g, "").slice(-9)}` }) });
  assert.equal(instrumentResponse.status, 201);
  const instrument = await instrumentResponse.json();

  const createdEvents = [];
  for (const event of fixture.income_events) {
    const response = await fetch(`${api}/api/v1/income-events`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, instrument_id: instrument.id, ...event }) });
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.status, event.status);
    assert.equal(payload.event_type, "DIVIDEND");
    createdEvents.push(payload);
  }

  const firstList = await fetch(`${api}/api/v1/income-events?portfolio_id=${portfolio.id}`, { headers: auth });
  assert.equal(firstList.status, 200);
  const firstState = await firstList.json();
  assert.equal(firstState.counts.total, fixture.expected.counts.total);
  assert.equal(firstState.counts.received, fixture.expected.counts.received);
  assert.equal(firstState.counts.expected, fixture.expected.counts.expected);
  assert.deepEqual(firstState.received.map((event) => event.status), ["PAID"]);
  assert.deepEqual(firstState.expected.map((event) => event.status).sort(), ["ANNOUNCED", "EX_DATE", "PROJECTED"]);

  const announced = createdEvents.find((event) => event.status === "ANNOUNCED");
  assert.ok(announced);
  const patch = await fetch(`${api}/api/v1/income-events/${announced.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ status: "PAID", payment_date: "2026-10-20" }) });
  assert.equal(patch.status, 200);
  assert.equal((await patch.json()).status, "PAID");

  const secondList = await fetch(`${api}/api/v1/income-events?portfolio_id=${portfolio.id}`, { headers: auth });
  assert.equal(secondList.status, 200);
  const secondState = await secondList.json();
  assert.equal(secondState.counts.received, 2);
  assert.equal(secondState.counts.expected, 2);
  assert.equal(secondState.counts.paid, 2);

  const badStatus = await fetch(`${api}/api/v1/income-events?portfolio_id=${portfolio.id}&status=UNKNOWN`, { headers: auth });
  assert.equal(badStatus.status, 400);

  const outsider = await fetch(`${api}/api/v1/income-events?portfolio_id=${portfolio.id}`);
  assert.equal(outsider.status, 401);

  const audit = await fetch(`${api}/api/v1/audit`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(audit.status, 200);
  assert.ok((await audit.json()).events.some((event) => event.entity_type === "INCOME_EVENT"));
});
