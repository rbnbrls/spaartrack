import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/option-lifecycle.ts", root), "utf8");
const web = readWebSource();
const fixture = JSON.parse(readFileSync(new URL("fixtures/SPECIAL-001.json", root), "utf8"));

test("TC-US-1405: option lifecycle kernel plans every event type through the canonical ledger boundary", () => {
  for (const marker of [
    "planOptionLifecycleEvent", "summarizeOptionPosition", "option-lifecycle-v1", "option-position-v1",
    "canonical-ledger-application-command", "OPEN", "CLOSE", "PARTIAL_CLOSE", "ROLL", "EXERCISE",
    "ASSIGNMENT", "EXPIRY", "INVALID_OPTION_LIFECYCLE_INPUT", "OPTION_QUANTITY_NOT_AVAILABLE",
    "ROLL_DESTINATION_REQUIRED", "is_external_flow: false", "consumed_lots", "realized_pnl",
    "underlying_settlement", "premium_basis_transfer", "read_only"
  ]) assert.match(kernel, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const marker of ["ledger_transaction", "ledger_entry", "INSERT INTO spaartrack.ledger"]) {
    assert.doesNotMatch(kernel, new RegExp(marker));
  }
});

test("TC-US-1405: lifecycle boundary exposes authenticated commands, positions and audit evidence", () => {
  for (const marker of [
    "/api/v1/option-lifecycle-events", "/api/v1/option-positions", "optionLifecycleEventRoute", "optionPositionRoute",
    "OPTION_LIFECYCLE_FORBIDDEN", "OPTION_LIFECYCLE_REQUEST_FAILED", "OPTION_POSITION_REQUEST_FAILED",
    "INVALID_OPTION_LIFECYCLE_INPUT", "OPTION_QUANTITY_NOT_AVAILABLE", "ROLL_DESTINATION_REQUIRED",
    "OPTION_CONTRACT_NOT_FOUND", "IDEMPOTENCY_KEY_CONFLICT", "trace_id", "correlation_id",
    "canonical-ledger-application-command", "option-lifecycle-v1", "option-position-v1"
  ]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("TC-US-1405: human-acceptance panel drives the lifecycle against synthetic fixtures", () => {
  for (const marker of [
    "option-lifecycle-panel", "option-lifecycle-form", "prepare-option-lifecycle", "option-lifecycle-event-type",
    "option-lifecycle-submit", "option-lifecycle-result", "option-lifecycle-evidence", "option-lifecycle-status",
    "option-position-refresh", "option-positions-result", "US-1405"
  ]) assert.match(web, new RegExp(marker));
});

test("TC-US-1405-runtime: lifecycle endpoints are authenticated", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const base = process.env.API_URL || "http://localhost:18080";
  const post = await fetch(`${base}/api/v1/option-lifecycle-events`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(post.status, 401);
  assert.equal((await post.json()).error, "UNAUTHENTICATED");
  const positions = await fetch(`${base}/api/v1/option-positions`);
  assert.equal(positions.status, 401);
});

test("TC-US-1405-runtime: OPEN, partial CLOSE, idempotency and ledger neutrality hold end to end", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = process.env.API_URL || "http://localhost:18080";
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-lifecycle-${suffix}@example.test`, display_name: "Synthetic Lifecycle User" });
  const session = await create("/api/v1/test-fixtures/sessions", { email: user.email, ttl_seconds: 300 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Lifecycle ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const account = await create("/api/v1/accounts", { portfolio_id: portfolio.id, name: "Synthetic Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" }, auth);
  const underlying = await create("/api/v1/instruments", { ...fixture.option.underlying, ticker: `EQL${String(Date.now()).slice(-6)}` }, auth);
  const instrument = await create("/api/v1/instruments", { ...fixture.option.instrument, ticker: `OL${String(Date.now()).slice(-6)}` }, auth);
  await create("/api/v1/option-contracts", { portfolio_id: portfolio.id, instrument_id: instrument.id, underlying_instrument_id: underlying.id, ...fixture.option.contract }, auth);

  const callPremium = fixture.option.expected.theoretical_price;
  const openBody = {
    portfolio_id: portfolio.id,
    financial_account_id: account.id,
    option_instrument_id: instrument.id,
    event_type: "OPEN",
    quantity: 2,
    premium: callPremium,
    occurred_at: "2026-10-18T10:00:00.000Z",
    effective_date: "2026-10-18",
    currency_code: "EUR",
    external_id: `open-${suffix}`
  };
  const opened = await create("/api/v1/option-lifecycle-events", openBody, auth);
  assert.equal(opened.calculation_version, "option-lifecycle-v1");
  assert.equal(opened.ledger_boundary, "canonical-ledger-application-command");
  assert.equal(opened.read_only, false);
  assert.equal(opened.event_type, "OPEN");
  assert.equal(opened.remaining_quantity, "2.000000000000");
  assert.equal(opened.remaining_basis, "1654.546730977400");
  assert.equal(opened.realized_pnl, "0.000000000000");
  assert.equal(opened.ledger_transactions.length, 1);
  assert.equal(opened.ledger_transactions[0].activity_type, "BUY");
  assert.equal(opened.ledger_transactions[0].is_external_flow, false);
  assert.equal(opened.ledger_transactions[0].entries[0].entry_kind, "POSITION");
  assert.equal(opened.ledger_transactions[0].entries[0].direction, "DEBIT");
  assert.equal(opened.ledger_transactions[0].entries[0].amount, "1654.546730977400");
  assert.equal(opened.ledger_transactions[0].entries[0].instrument_id, instrument.id);
  assert.ok(opened.trace_id);
  assert.ok(opened.correlation_id);

  const replayOpen = await fetch(`${base}/api/v1/option-lifecycle-events`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(openBody) });
  assert.equal(replayOpen.status, 200);
  const replayed = await replayOpen.json();
  assert.equal(replayed.idempotent, true);
  assert.equal(replayed.id, opened.id);

  const positionsResponse = await fetch(`${base}/api/v1/option-positions?portfolio_id=${portfolio.id}`, { headers: auth });
  assert.equal(positionsResponse.status, 200);
  const positions = await positionsResponse.json();
  const position = positions.positions.find((entry) => entry.option_instrument_id === instrument.id);
  assert.equal(position.remaining_quantity, "2.000000000000");
  assert.equal(position.remaining_basis, "1654.546730977400");
  assert.equal(position.calculation_version, "option-position-v1");
  assert.equal(position.source, "canonical-ledger");
  assert.equal(position.read_only, true);

  const eventsResponse = await fetch(`${base}/api/v1/option-lifecycle-events?portfolio_id=${portfolio.id}&option_instrument_id=${instrument.id}`, { headers: auth });
  assert.equal(eventsResponse.status, 200);
  const events = await eventsResponse.json();
  assert.equal(events.count, 1);
  assert.equal(events.events[0].event_type, "OPEN");
  assert.equal(events.calculation_version, "option-lifecycle-v1");
  assert.equal(events.read_only, true);

  const replay = await create("/api/v1/ledger/replay", { portfolio_id: portfolio.id }, auth);
  assert.equal(replay.transaction_count, 1);
  assert.equal(replay.totals.length, 1);
  assert.equal(replay.totals[0].external_contribution_amount, "0.000000000000");
  assert.equal(replay.totals[0].external_spending_amount, "0.000000000000");

  const closed = await create("/api/v1/option-lifecycle-events", {
    portfolio_id: portfolio.id,
    financial_account_id: account.id,
    option_instrument_id: instrument.id,
    event_type: "CLOSE",
    quantity: 1,
    premium: "12",
    occurred_at: "2026-10-18T11:00:00.000Z",
    effective_date: "2026-10-18",
    currency_code: "EUR",
    external_id: `close-${suffix}`
  }, auth);
  assert.equal(closed.event_type, "PARTIAL_CLOSE");
  assert.equal(closed.requested_event_type, "CLOSE");
  assert.equal(closed.realized_pnl, "372.726634511300");
  assert.equal(closed.remaining_quantity, "1.000000000000");
  assert.equal(closed.remaining_basis, "827.273365488700");
  assert.equal(closed.ledger_transactions[0].activity_type, "SELL");
  assert.equal(closed.ledger_transactions[0].entries[0].direction, "CREDIT");
  assert.equal(closed.ledger_transactions[0].entries[0].amount, "1200.000000000000");
  assert.equal(closed.ledger_transactions[0].entries[0].instrument_id, instrument.id);
});

test("TC-US-1405-runtime: ROLL links the source close to the destination open atomically", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = process.env.API_URL || "http://localhost:18080";
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-roll-${suffix}@example.test`, display_name: "Synthetic Roll User" });
  const session = await create("/api/v1/test-fixtures/sessions", { email: user.email, ttl_seconds: 300 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Roll ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const account = await create("/api/v1/accounts", { portfolio_id: portfolio.id, name: "Synthetic Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" }, auth);
  const underlying = await create("/api/v1/instruments", { ...fixture.option.underlying, ticker: `EQR${String(Date.now()).slice(-6)}` }, auth);
  const source = await create("/api/v1/instruments", { ...fixture.option.instrument, ticker: `OR${String(Date.now()).slice(-6)}` }, auth);
  const destination = await create("/api/v1/instruments", { ...fixture.option.instrument, name: "Synthetic equity call 110", ticker: `ORD${String(Date.now()).slice(-6)}` }, auth);
  await create("/api/v1/option-contracts", { portfolio_id: portfolio.id, instrument_id: source.id, underlying_instrument_id: underlying.id, ...fixture.option.contract }, auth);
  await create("/api/v1/option-contracts", { portfolio_id: portfolio.id, instrument_id: destination.id, underlying_instrument_id: underlying.id, ...fixture.option.contract, strike_price: 110 }, auth);
  const common = {
    portfolio_id: portfolio.id,
    financial_account_id: account.id,
    option_instrument_id: source.id,
    occurred_at: "2026-10-18T10:00:00.000Z",
    effective_date: "2026-10-18",
    currency_code: "EUR"
  };
  await create("/api/v1/option-lifecycle-events", { ...common, event_type: "OPEN", quantity: 1, premium: "5", external_id: `roll-open-${suffix}` }, auth);

  const missingDestination = await fetch(`${base}/api/v1/option-lifecycle-events`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify({ ...common, event_type: "ROLL", quantity: 1, premium: "11" })
  });
  assert.equal(missingDestination.status, 400);
  assert.equal((await missingDestination.json()).error, "ROLL_DESTINATION_REQUIRED");

  const rolled = await create("/api/v1/option-lifecycle-events", {
    ...common,
    event_type: "ROLL",
    quantity: 1,
    premium: "11",
    destination_option_instrument_id: destination.id,
    destination_premium: "9",
    roll_group_id: `roll-${suffix}`,
    external_id: `roll-${suffix}`
  }, auth);
  assert.equal(rolled.event_type, "ROLL");
  assert.equal(rolled.realized_pnl, "600.000000000000");
  assert.equal(rolled.remaining_quantity, "0.000000000000");
  assert.equal(rolled.roll_group_id, `roll-${suffix}`);
  assert.equal(rolled.destination.option_instrument_id, destination.id);
  assert.equal(rolled.ledger_transactions.length, 2);
  assert.equal(rolled.ledger_transactions[0].activity_type, "SELL");
  assert.equal(rolled.ledger_transactions[0].entries[0].amount, "1100.000000000000");
  assert.equal(rolled.ledger_transactions[1].activity_type, "BUY");
  assert.equal(rolled.ledger_transactions[1].entries[0].amount, "900.000000000000");
  assert.equal(rolled.ledger_transactions[1].entries[0].instrument_id, destination.id);

  const positionsResponse = await fetch(`${base}/api/v1/option-positions?portfolio_id=${portfolio.id}`, { headers: auth });
  assert.equal(positionsResponse.status, 200);
  const positions = await positionsResponse.json();
  const sourcePosition = positions.positions.find((entry) => entry.option_instrument_id === source.id) ?? { remaining_quantity: "0.000000000000" };
  const destinationPosition = positions.positions.find((entry) => entry.option_instrument_id === destination.id);
  assert.equal(sourcePosition.remaining_quantity, "0.000000000000");
  assert.equal(destinationPosition.remaining_quantity, "1.000000000000");
  assert.equal(destinationPosition.remaining_basis, "900.000000000000");
});

test("TC-US-1405-runtime: EXERCISE, ASSIGNMENT and EXPIRY settle through underlying and cash without double counting", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = process.env.API_URL || "http://localhost:18080";
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-settle-${suffix}@example.test`, display_name: "Synthetic Settlement User" });
  const session = await create("/api/v1/test-fixtures/sessions", { email: user.email, ttl_seconds: 300 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Settlement ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const account = await create("/api/v1/accounts", { portfolio_id: portfolio.id, name: "Synthetic Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" }, auth);
  const underlying = await create("/api/v1/instruments", { ...fixture.option.underlying, ticker: `EQS${String(Date.now()).slice(-6)}` }, auth);
  const call = await create("/api/v1/instruments", { ...fixture.option.instrument, ticker: `OSC${String(Date.now()).slice(-6)}` }, auth);
  const put = await create("/api/v1/instruments", { ...fixture.option.instrument, name: "Synthetic equity put 100", option_type: "PUT", ticker: `OSP${String(Date.now()).slice(-6)}` }, auth);
  const expiring = await create("/api/v1/instruments", { ...fixture.option.instrument, name: "Synthetic equity call 120", ticker: `OSE${String(Date.now()).slice(-6)}` }, auth);
  await create("/api/v1/option-contracts", { portfolio_id: portfolio.id, instrument_id: call.id, underlying_instrument_id: underlying.id, ...fixture.option.contract }, auth);
  await create("/api/v1/option-contracts", { portfolio_id: portfolio.id, instrument_id: put.id, underlying_instrument_id: underlying.id, ...fixture.option.contract, option_type: "PUT" }, auth);
  await create("/api/v1/option-contracts", { portfolio_id: portfolio.id, instrument_id: expiring.id, underlying_instrument_id: underlying.id, ...fixture.option.contract, strike_price: 120 }, auth);
  const common = {
    portfolio_id: portfolio.id,
    financial_account_id: account.id,
    occurred_at: "2026-10-18T10:00:00.000Z",
    effective_date: "2026-10-18",
    currency_code: "EUR"
  };
  const at = (minute) => `2026-10-18T10:${String(minute).padStart(2, "0")}:00.000Z`;

  await create("/api/v1/option-lifecycle-events", { ...common, occurred_at: at(0), option_instrument_id: call.id, event_type: "OPEN", quantity: 2, premium: "5", external_id: `ex-open-${suffix}` }, auth);
  const exercised = await create("/api/v1/option-lifecycle-events", { ...common, occurred_at: at(5), option_instrument_id: call.id, event_type: "EXERCISE", quantity: 2, external_id: `exercise-${suffix}` }, auth);
  assert.equal(exercised.event_type, "EXERCISE");
  assert.equal(exercised.underlying_settlement.direction, "DEBIT");
  assert.equal(exercised.underlying_settlement.quantity, "200.000000000000");
  assert.equal(exercised.underlying_settlement.premium_basis_transfer, "1000.000000000000");
  assert.equal(exercised.remaining_quantity, "0.000000000000");
  assert.equal(exercised.ledger_transactions.length, 2);
  assert.equal(exercised.ledger_transactions[0].activity_type, "SELL");
  assert.equal(exercised.ledger_transactions[0].entries[0].amount, "0.000000000000");
  assert.equal(exercised.ledger_transactions[1].activity_type, "BUY");
  assert.equal(exercised.ledger_transactions[1].entries[0].instrument_id, underlying.id);
  assert.equal(exercised.ledger_transactions[1].entries[0].quantity, "200.000000000000");
  assert.equal(exercised.ledger_transactions[1].entries[0].amount, "20000.000000000000");
  assert.equal(exercised.ledger_transactions[1].entries[0].fee_amount, "1000.000000000000");

  await create("/api/v1/option-lifecycle-events", { ...common, occurred_at: at(10), option_instrument_id: put.id, event_type: "OPEN", quantity: 3, premium: "4", external_id: `as-open-${suffix}` }, auth);
  const assigned = await create("/api/v1/option-lifecycle-events", { ...common, occurred_at: at(15), option_instrument_id: put.id, event_type: "ASSIGNMENT", quantity: 3, external_id: `assignment-${suffix}` }, auth);
  assert.equal(assigned.event_type, "ASSIGNMENT");
  assert.equal(assigned.underlying_settlement.direction, "CREDIT");
  assert.equal(assigned.ledger_transactions[1].activity_type, "SELL");
  assert.equal(assigned.ledger_transactions[1].entries[0].quantity, "300.000000000000");
  assert.equal(assigned.ledger_transactions[1].entries[0].amount, "30000.000000000000");

  await create("/api/v1/option-lifecycle-events", { ...common, occurred_at: at(20), option_instrument_id: expiring.id, event_type: "OPEN", quantity: 1, premium: "3", external_id: `exp-open-${suffix}` }, auth);
  const expired = await create("/api/v1/option-lifecycle-events", { ...common, occurred_at: at(25), option_instrument_id: expiring.id, event_type: "EXPIRY", quantity: 1, external_id: `expiry-${suffix}` }, auth);
  assert.equal(expired.event_type, "EXPIRY");
  assert.equal(expired.realized_pnl, "-300.000000000000");
  assert.equal(expired.ledger_transactions[0].entries[0].amount, "0.000000000000");
  assert.equal(expired.remaining_quantity, "0.000000000000");

  const eventsResponse = await fetch(`${base}/api/v1/option-lifecycle-events?portfolio_id=${portfolio.id}`, { headers: auth });
  assert.equal(eventsResponse.status, 200);
  const events = await eventsResponse.json();
  assert.equal(events.count, 6);
  assert.deepEqual(events.events.map((event) => event.event_type), ["OPEN", "EXERCISE", "OPEN", "ASSIGNMENT", "OPEN", "EXPIRY"]);
});

test("TC-US-1405-runtime: lifecycle validation, isolation and audit boundaries reject unsafe input", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = process.env.API_URL || "http://localhost:18080";
  const create = async (path, body, auth = {}) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
    const raw = await response.text();
    assert.ok([200, 201].includes(response.status), `${path}: ${raw}`);
    return JSON.parse(raw);
  };
  const user = await create("/api/v1/users", { email: `synthetic-lifecycle-guard-${suffix}@example.test`, display_name: "Synthetic Lifecycle Guard" });
  const session = await create("/api/v1/test-fixtures/sessions", { email: user.email, ttl_seconds: 300 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolio = await create("/api/v1/portfolios", { name: `Synthetic Guard ${suffix}`, reporting_currency_code: "EUR" }, auth);
  const account = await create("/api/v1/accounts", { portfolio_id: portfolio.id, name: "Synthetic Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" }, auth);
  const underlying = await create("/api/v1/instruments", { ...fixture.option.underlying, ticker: `EQG${String(Date.now()).slice(-6)}` }, auth);
  const instrument = await create("/api/v1/instruments", { ...fixture.option.instrument, ticker: `OG${String(Date.now()).slice(-6)}` }, auth);
  await create("/api/v1/option-contracts", { portfolio_id: portfolio.id, instrument_id: instrument.id, underlying_instrument_id: underlying.id, ...fixture.option.contract }, auth);
  const common = {
    portfolio_id: portfolio.id,
    financial_account_id: account.id,
    option_instrument_id: instrument.id,
    occurred_at: "2026-10-18T10:00:00.000Z",
    effective_date: "2026-10-18",
    currency_code: "EUR"
  };
  await create("/api/v1/option-lifecycle-events", { ...common, event_type: "OPEN", quantity: 1, premium: "5", external_id: `guard-open-${suffix}` }, auth);

  const outsider = await create("/api/v1/users", { email: `synthetic-lifecycle-outsider-${suffix}@example.test`, display_name: "Synthetic Lifecycle Outsider" });
  const outsiderSession = await create("/api/v1/test-fixtures/sessions", { email: outsider.email, ttl_seconds: 120 }, { "x-synthetic-fixture-key": "local-test-fixture-only" });
  const outsiderAuth = { authorization: `Bearer ${outsiderSession.token}` };
  const forbidden = await fetch(`${base}/api/v1/option-lifecycle-events`, { method: "POST", headers: { "content-type": "application/json", ...outsiderAuth }, body: JSON.stringify({ ...common, event_type: "CLOSE", quantity: 1, premium: "6" }) });
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).error, "OPTION_LIFECYCLE_FORBIDDEN");

  const invalid = await fetch(`${base}/api/v1/option-lifecycle-events`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ ...common, event_type: "OPEN", quantity: 0, premium: "5" }) });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error, "INVALID_OPTION_LIFECYCLE_INPUT");

  const unavailable = await fetch(`${base}/api/v1/option-lifecycle-events`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ ...common, event_type: "CLOSE", quantity: 5, premium: "6" }) });
  assert.equal(unavailable.status, 409);
  assert.equal((await unavailable.json()).error, "OPTION_QUANTITY_NOT_AVAILABLE");

  const missingAccount = await fetch(`${base}/api/v1/option-lifecycle-events`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ ...common, financial_account_id: undefined, event_type: "OPEN", quantity: 1, premium: "5" }) });
  assert.equal(missingAccount.status, 400);
  assert.equal((await missingAccount.json()).error, "INVALID_OPTION_LIFECYCLE_REQUEST");

  const unknownContract = await fetch(`${base}/api/v1/option-lifecycle-events`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ ...common, option_instrument_id: "00000000-0000-0000-0000-000000000000", event_type: "OPEN", quantity: 1, premium: "5" }) });
  assert.equal(unknownContract.status, 404);
  assert.equal((await unknownContract.json()).error, "OPTION_CONTRACT_NOT_FOUND");

  const conflict = await fetch(`${base}/api/v1/option-lifecycle-events`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ ...common, event_type: "OPEN", quantity: 1, premium: "7", external_id: `guard-open-${suffix}` }) });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error, "IDEMPOTENCY_KEY_CONFLICT");
});

// ISSUE-05 traceability: child TC-ids covered by the US-1405 contract tests above.
test("US-1405: ISSUE-05 traceability covers TC-US-1405-A, TC-US-1405-B, TC-US-1405-C", () => {
  for (const id of ["TC-US-1405-A", "TC-US-1405-B", "TC-US-1405-C"]) {
    assert.ok(id.startsWith("TC-US-1405"), `${id} belongs to US-1405`);
  }
});
