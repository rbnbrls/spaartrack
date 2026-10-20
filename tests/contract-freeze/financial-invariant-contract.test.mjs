import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// W0-2 executable financial invariant contract (US-0002-A / US-0002-B / US-0002-C).
//
// This file is deliberately OUTSIDE the default test glob
// (`node --test tests/unit/*.test.mjs tests/smoke/*.test.mjs`). The Wave 0 gate
// is "the first tests stand red": this contract is RED BY DESIGN until the
// Ledger and Calculations owners close the decisions named in `unresolved_decisions`.
// Running it in the default regression gate would poison the gate every other
// story depends on. Run it explicitly with:
//
//   pnpm test:contract-freeze
//
// Everything below is synthetic. No provider credential, no production data,
// no direct ledger write, no schema or migration change.

const root = new URL("../..", import.meta.url);
const read = (relativePath) => readFileSync(new URL(relativePath, root), "utf8");

const fixture = JSON.parse(read("fixtures/W0-2-financial-contract-v1.json"));
const apiSource = read("apps/api/src/index.ts");
const schemaSource = read("database/schema.sql");
const adrSource = read("docs/adr/0002-canonical-ledger.md");
const testCases = read("test-cases.md");
const refinement = read("docs/backlog/b-004-refinement.md");

// Owner decision records. These are the canonical source for what is decided;
// the RED guard below is derived from them, not from a hand-editable flag.
const ledgerPolicy = read("docs/decisions/w0-2-ledger-policy.md");
const calculationPolicy = read("docs/decisions/w0-2-calculation-policy.md");
const sellLegDetermination = read("docs/decisions/w0-2-sell-cash-leg-determination-v1.md");
const sellLegConcurrence = read("docs/decisions/w0-2-sell-cash-leg-concurrence-v1.md");

const getCase = (caseId) => fixture.cases.find((candidate) => candidate.case_id === caseId);

// An owner record states the current disposition of the W0-2 policy questions
// in a table whose first cell is the decision id and whose second cell is the
// disposition. The newest record that carries a COMPLETE table for every
// decision in the inventory is the canonical one, so the RED guard follows new
// owner records instead of pinning one file.
const OWNER_DECISION_IDS = fixture.unresolved_decisions.map(({ id }) => id);

function parseDispositionTable(source) {
  const statuses = new Map();
  for (const line of source.split("\n")) {
    const match = line.match(/^\|\s*\*{0,2}(D-[A-Z0-9-]+)\*{0,2}\s*\|\s*\*{0,2}([A-Z][^*|]*)/);
    if (!match) continue;
    const status = match[2].trim();
    if (/^NOT DECIDED/.test(status)) statuses.set(match[1], "NOT DECIDED");
    else if (/^PARTIALLY DECIDED/.test(status)) statuses.set(match[1], "PARTIALLY DECIDED");
    else if (/^DECIDED/.test(status)) statuses.set(match[1], "DECIDED");
    else if (/^JOINTLY APPROVED/.test(status)) statuses.set(match[1], "JOINTLY APPROVED");
  }
  return statuses;
}

// The decision index lists the owner records in landing order; the last one
// with a complete disposition table wins.
const ownerRecordPaths = [...read("docs/decisions/README.md").matchAll(/^\| `([^`]+\.md)`/gm)].map(
  (match) => `docs/decisions/${match[1]}`,
);

let ownerDecisionStatuses = new Map();
let ownerDecisionSource = null;
for (const recordPath of ownerRecordPaths) {
  const statuses = parseDispositionTable(read(recordPath));
  if (OWNER_DECISION_IDS.every((id) => statuses.has(id))) {
    ownerDecisionStatuses = statuses;
    ownerDecisionSource = recordPath;
  }
}

const OPEN_STATUS = /NOT DECIDED|PARTIALLY DECIDED/;
const openOwnerDecisions = OWNER_DECISION_IDS.filter((id) => OPEN_STATUS.test(ownerDecisionStatuses.get(id) ?? "")).sort();

// Every expected output of every case, spelled out here. The fixture is data;
// these are the contract values, and the two must agree leaf by leaf.
const EXPECTED_THEN = {
  "A-CASH-SIGNS-001": {
    balance_by_account_currency: "80.000000000000",
    external_contribution: "100.000000000000",
    external_spending: "20.000000000000",
    cash_entry_amounts_are_non_negative: true,
  },
  "A-BUY-SELL-QUANTITY-001": {
    remaining_quantity: "6.000000000000",
    cash_entry_direction_buy: "DEBIT",
    cash_entry_direction_sell: "CREDIT",
    sell_quantity_must_not_increase_position: true,
  },
  "A-SHORT-REJECTION-001": {
    sell_above_available_quantity_is_rejected: true,
    rejection_status: 409,
    rejection_error: "SHORT_POSITION_NOT_PERMITTED",
    no_short_position_is_opened: true,
    no_short_cover_operation_exists: true,
    correction_that_would_break_the_position_constraint_is_rejected: true,
    correction_rejection_error: "CORRECTION_BREAKS_POSITION_CONSTRAINT",
  },
  "B-PARTIAL-SELL-FIFO-WAC-001": {
    FIFO: {
      remaining_quantity: "3.000000000000",
      remaining_cost_basis: "42.600000000000",
      realized_gain: "101.600000000000",
    },
    WAC: {
      remaining_quantity: "3.000000000000",
      remaining_cost_basis: "34.800000000000",
      realized_gain: "93.800000000000",
    },
    total_fees: "6.000000000000",
    total_taxes: "5.000000000000",
    cost_basis_method_is_reported: true,
    calculation_version_is_reported: true,
  },
  "B-PRICE-FX-DECOMPOSITION-001": {
    remaining_quantity: "6.000000000000",
    remaining_cost_basis_transaction_currency: "61.800000000000",
    realized_pnl_transaction_currency: "16.800000000000",
    realized_pnl_reporting_currency: "15.120000000000",
    price_pnl_reporting_currency: "46.560000000000",
    fx_pnl_reporting_currency: "12.000000000000",
    unrealized_pnl_reporting_currency: "58.560000000000",
    total_pnl_reporting_currency: "73.680000000000",
    fees_total: "3.000000000000",
    taxes_total: "2.000000000000",
  },
  "C-PAIRED-TRANSFER-NEUTRALITY-001": {
    source_activity_type: "TRANSFER_OUT",
    destination_activity_type: "TRANSFER_IN",
    source_direction: "DEBIT",
    destination_direction: "CREDIT",
    both_legs_reference_each_other: true,
    both_legs_are_external_flow_false: true,
    portfolio_external_contribution_delta: "0.000000000000",
    portfolio_external_spending_delta: "0.000000000000",
    correction_preserves_both_original_legs: true,
    correction_reason_and_actor_are_auditable: true,
  },
  "C-IDEMPOTENCY-REPLAY-CONFLICT-001": {
    exact_replay_returns_original_activity: true,
    exact_replay_creates_no_second_entry_audit_action_or_event: true,
    changed_content_response_status: 409,
    changed_content_error: "IDEMPOTENCY_KEY_CONFLICT",
    different_account_is_independent: true,
    replay_outputs_and_hash_are_deterministic_for_same_ledger_and_version: true,
  },
  "C-VOID-REPLAY-RESTORE-001": {
    original_activity_and_entries_are_preserved: true,
    voided_activity_is_excluded_from_posted_balance_and_totals: true,
    correction_has_reason_actor_trace_id_and_correlation_id: true,
    restored_balances_equal_pre_backup_balances: true,
    restored_totals_equal_pre_backup_totals: true,
    restored_replay_hash_matches_same_logical_ledger_and_calculation_version: true,
    restore_database_is_disposable_and_isolated: true,
  },
};

// The synthetic inputs each expected output is computed from. Pinning the
// inputs keeps the golden outputs reproducible from the contract alone.
const EXPECTED_GIVEN = {
  "A-CASH-SIGNS-001": {
    account_id: "synthetic-cash-eur",
    currency_code: "EUR",
    opening_balance: "0.000000000000",
    transactions: [
      { activity_type: "DEPOSIT", amount: "100.00", expected_direction: "CREDIT" },
      { activity_type: "WITHDRAWAL", amount: "20.00", expected_direction: "DEBIT" },
    ],
  },
  "A-BUY-SELL-QUANTITY-001": {
    account_id: "synthetic-brokerage-eur",
    instrument_id: "synthetic-equity-eur",
    currency_code: "EUR",
    transactions: [
      { activity_type: "BUY", quantity: "10", unit_price: "10", amount: "100" },
      { activity_type: "SELL", quantity: "4", unit_price: "15", amount: "60" },
    ],
  },
  "A-SHORT-REJECTION-001": {
    account_id: "synthetic-brokerage-eur-short",
    instrument_id: "synthetic-equity-eur-short",
    currency_code: "EUR",
    posted_position_quantity: "3.000000000000",
    requested_sell_quantity: "4.000000000000",
  },
  "B-PARTIAL-SELL-FIFO-WAC-001": {
    instrument_id: "synthetic-equity-eur",
    currency_code: "EUR",
    transactions: [
      { activity_type: "BUY", amount: "100", quantity: "10", unit_price: "10", fee_amount: "2", tax_amount: "1" },
      { activity_type: "BUY", amount: "70", quantity: "5", unit_price: "14", fee_amount: "1", tax_amount: "0" },
      { activity_type: "SELL", amount: "240", quantity: "12", unit_price: "20", fee_amount: "3", tax_amount: "4" },
    ],
  },
  "B-PRICE-FX-DECOMPOSITION-001": {
    instrument_id: "synthetic-equity-usd",
    currency_code: "USD",
    transactions: [
      { activity_type: "BUY", amount: "100", quantity: "10", unit_price: "10", fee_amount: "2", tax_amount: "1" },
      { activity_type: "SELL", amount: "60", quantity: "4", unit_price: "15", fee_amount: "1", tax_amount: "1" },
    ],
    valuation: { price: "20", valuation_fx_rate: "0.9", cost_basis_fx_rate: "0.8" },
  },
  "C-PAIRED-TRANSFER-NEUTRALITY-001": {
    source_account_id: "synthetic-cash-eur-a",
    destination_account_id: "synthetic-cash-eur-b",
    currency_code: "EUR",
    amount: "25.50",
    external_id: "synthetic-transfer-0002-001",
  },
  "C-IDEMPOTENCY-REPLAY-CONFLICT-001": {
    account_id: "synthetic-cash-eur-a",
    identity: { kind: "external_id", value: "synthetic-external-0002-001" },
    normalized_posting: {
      activity_type: "DEPOSIT",
      amount: "42.00",
      currency_code: "EUR",
      effective_date: "2026-04-01",
    },
  },
  "C-VOID-REPLAY-RESTORE-001": {
    synthetic_ledger_activity_ids: [
      "synthetic-activity-deposit",
      "synthetic-activity-buy",
      "synthetic-activity-transfer-out",
      "synthetic-activity-transfer-in",
    ],
    correction_reason: "Synthetic duplicate correction",
    trace_id: "trace-w0-2-void-001",
    correlation_id: "corr-w0-2-ledger-001",
  },
};

const CASE_TO_TRACE = {
  "A-CASH-SIGNS-001": "TC-US-0002-A",
  "A-BUY-SELL-QUANTITY-001": "TC-US-0002-A",
  "A-SHORT-REJECTION-001": "TC-US-0002-A",
  "B-PARTIAL-SELL-FIFO-WAC-001": "TC-US-0002-B",
  "B-PRICE-FX-DECOMPOSITION-001": "TC-US-0002-B",
  "C-PAIRED-TRANSFER-NEUTRALITY-001": "TC-US-0002-C",
  "C-IDEMPOTENCY-REPLAY-CONFLICT-001": "TC-US-0002-C",
  "C-VOID-REPLAY-RESTORE-001": "TC-US-0002-C",
};

// The refinement catalog is owned by other cards and its row text may change,
// so the traceability is asserted on row CONTENT (story, owner, TC id), never
// on a line count or a hash of the file.
function refinementRow(storyId) {
  const row = refinement.split("\n").find((line) => line.startsWith(`| ${storyId} |`));
  assert.ok(row, `${storyId} must have a row in docs/backlog/b-004-refinement.md`);
  // Drop the empty leading/trailing cells produced by the leading and trailing pipes.
  return row.split("|").map((cell) => cell.trim()).filter((cell, index, all) => !(index === 0 && cell === "") && !(index === all.length - 1 && cell === ""));
}

function assertRefinementRow(storyId, parentStory, ownerTokens, testId) {
  const cells = refinementRow(storyId);
  assert.equal(cells[0], storyId, `refinement row must start with ${storyId}`);
  assert.equal(cells[1], parentStory, `${storyId} must be a child of ${parentStory}`);
  for (const token of ownerTokens) {
    assert.ok(cells[2].includes(token), `${storyId} owner column must name ${token}, got "${cells[2]}"`);
  }
  assert.ok(cells.includes(testId), `${storyId} must point at ${testId}, got row ${cells.join(" | ")}`);
}

test("TC-US-0002-A: cash-sign and quantity cases are executable and traceable to their owners", () => {
  assert.deepEqual(fixture.traceability.stories, ["US-0002-A", "US-0002-B", "US-0002-C"]);
  assert.deepEqual(fixture.traceability.tests, ["TC-US-0002-A", "TC-US-0002-B", "TC-US-0002-C"]);
  assert.deepEqual(fixture.traceability.release_gates, ["TC-X-003", "TC-X-006", "TC-X-007"]);

  // Story and test traceability in the canonical catalogs.
  assert.match(testCases, /TC-US-0002-A \| US-0002-A/);
  assertRefinementRow("US-0002-A", "US-0002", ["architecture", "qa"], "TC-US-0002-A");
  assertRefinementRow("US-0002-B", "US-0002", ["architecture", "calculations"], "TC-US-0002-B");
  assertRefinementRow("US-0002-C", "US-0002", ["architecture", "ledger"], "TC-US-0002-C");
  for (const gate of fixture.traceability.release_gates) {
    assert.ok(testCases.includes(gate), `release gate ${gate} must be documented in test-cases.md`);
  }

  // Every expected output is pinned, including the cash-leg directions that
  // no other test in the repository asserted before this contract.
  for (const [caseId, expected] of Object.entries(EXPECTED_THEN)) {
    assert.deepEqual(getCase(caseId).then, expected, `${caseId} expected outputs must match the contract`);
  }
  for (const [caseId, expected] of Object.entries(EXPECTED_GIVEN)) {
    assert.deepEqual(getCase(caseId).given, expected, `${caseId} synthetic inputs must match the contract`);
    assert.equal(getCase(caseId).trace, CASE_TO_TRACE[caseId]);
  }

  // The A-case cash-leg direction is the canonical ADR-0002 cash sign.
  assert.match(adrSource, /DEBIT verlaagt, CREDIT verhoogt/);
  assert.match(adrSource, /ledger_transaction en ledger_entry zijn de financiële bron van waarheid/);

  // The SELL cash leg is CREDIT: the Ledger owner determined the leg and the
  // Calculations owner reciprocally concurred on the value.
  assert.match(sellLegDetermination, /the SELL cash leg is a \*\*CREDIT\*\*/);
  assert.match(sellLegConcurrence, /canonical value of that leg is \*\*CREDIT\*\*/);
  assert.match(ledgerPolicy, /\| SELL \| Credit `amount - fee_amount - tax_amount` \|/);
  assert.match(calculationPolicy, /SELL: cash credit = gross amount/);
  assert.equal(getCase("A-BUY-SELL-QUANTITY-001").then.cash_entry_direction_sell, "CREDIT");
  assert.equal(getCase("A-BUY-SELL-QUANTITY-001").then.cash_entry_direction_buy, "DEBIT");

  // The approved golden cash figures are also present in the owner records, so
  // the values above are not QA-invented.
  for (const value of ["80.000000000000", "100.000000000000", "20.000000000000", "6.000000000000"]) {
    assert.ok(ledgerPolicy.includes(value) && calculationPolicy.includes(value), `owner records must carry ${value}`);
  }

  // D-SHORT-01 is DECIDED (bounded) by the Ledger owner: every SELL that would
  // make the position negative is rejected, with no short-open and no short
  // cover. The determination names QA as the party that encodes and exercises
  // this, so the contract carries it as an executable case.
  const shortCase = getCase("A-SHORT-REJECTION-001").then;
  assert.equal(shortCase.rejection_status, 409);
  assert.equal(shortCase.rejection_error, "SHORT_POSITION_NOT_PERMITTED");
  assert.equal(shortCase.correction_rejection_error, "CORRECTION_BREAKS_POSITION_CONSTRAINT");
  for (const phrase of [
    "reject every SELL that would make the position negative",
    "no short-open for any account or instrument class",
    "no short cover",
    "`409 SHORT_POSITION_NOT_PERMITTED`",
    "correction guard `CORRECTION_BREAKS_POSITION_CONSTRAINT`",
    "SHORT-SELL-INSUFFICIENT-001",
    "SHORT-UNSUPPORTED-INSTRUMENT-001",
    "SHORT-CORRECTION-REPLAY-001",
    "QA encodes the decision in the fixture/smoke test",
  ]) {
    assert.ok(sellLegDetermination.includes(phrase), `owner determination must carry "${phrase}"`);
  }

  // Existing implementation boundaries the contract will be executed against.
  for (const value of [
    "/api/v1/ledger/transactions",
    "ledger_entry",
    "DEPOSIT",
    "WITHDRAWAL",
    "BUY",
    "SELL",
    "quantity",
    "amount",
    "currency_code",
  ]) {
    assert.ok(apiSource.includes(value) || schemaSource.includes(value), `missing existing implementation boundary: ${value}`);
  }
  assert.match(schemaSource, /entry_kind text NOT NULL CHECK \(entry_kind IN \('CASH', 'POSITION', 'FEE', 'TAX', 'MEMO'\)\)/);
  assert.match(schemaSource, /direction text NOT NULL CHECK \(direction IN \('DEBIT', 'CREDIT'\)\)/);
});

test("TC-US-0002-A: the decided D-SHORT-01 policy is enforced by the implementation (RED until W0-3)", () => {
  // Failing-before evidence. D-SHORT-01 is DECIDED, so this contract needs no
  // further owner answer: it is RED purely because the implementation does not
  // enforce the decided policy yet. The current trade path posts one POSITION
  // entry and has no quantity guard at all, so an oversell is not rejected.
  assert.ok(
    apiSource.includes("SHORT_POSITION_NOT_PERMITTED"),
    "RED: the decided D-SHORT-01 policy (409 SHORT_POSITION_NOT_PERMITTED) is not implemented yet",
  );
  assert.ok(
    apiSource.includes("CORRECTION_BREAKS_POSITION_CONSTRAINT"),
    "RED: the decided D-SHORT-01 correction guard (CORRECTION_BREAKS_POSITION_CONSTRAINT) is not implemented yet",
  );
});

test("TC-US-0002-B: partial sale, fee/tax and price-vs-FX outputs are executable golden values", () => {
  assert.match(testCases, /TC-US-0002-B \| US-0002-B/);

  for (const [caseId, expected] of Object.entries(EXPECTED_THEN)) {
    if (CASE_TO_TRACE[caseId] !== "TC-US-0002-B") continue;
    assert.deepEqual(getCase(caseId).then, expected, `${caseId} expected outputs must match the contract`);
  }
  for (const [caseId, expected] of Object.entries(EXPECTED_GIVEN)) {
    if (CASE_TO_TRACE[caseId] !== "TC-US-0002-B") continue;
    assert.deepEqual(getCase(caseId).given, expected, `${caseId} synthetic inputs must match the contract`);
  }

  // The B-case golden values are the owner-approved ones, present verbatim in
  // the joint Ledger/Calculations policy records.
  const ownerApproved = [
    "42.600000000000",
    "101.600000000000",
    "34.800000000000",
    "93.800000000000",
    "15.120000000000",
    "46.560000000000",
    "12.000000000000",
    "58.560000000000",
    "73.680000000000",
    "61.800000000000",
    "16.800000000000",
  ];
  for (const value of ownerApproved) {
    assert.ok(calculationPolicy.includes(value), `owner record must carry ${value}`);
    assert.ok(sellLegConcurrence.includes(value), `concurrence record must carry ${value}`);
  }
  assert.match(ledgerPolicy, /\| BUY \| Debit `amount \+ fee_amount \+ tax_amount` \|/);
  assert.match(calculationPolicy, /BUY: cash debit = gross amount \+ fee \+ tax/);

  // The calculation cases are evaluated in isolation: their own account/lot
  // scope keeps the approved FIFO/WAC values reproducible.
  assert.equal(getCase("B-PARTIAL-SELL-FIFO-WAC-001").given.instrument_id, "synthetic-equity-eur");
  assert.equal(getCase("B-PARTIAL-SELL-FIFO-WAC-001").given.account_id, undefined);
  assert.equal(getCase("B-PRICE-FX-DECOMPOSITION-001").given.instrument_id, "synthetic-equity-usd");
  assert.equal(fixture.common.calculation_version, "cost-basis-v1 / pnl-v1 / ledger-replay-v1");

  for (const value of [
    "/api/v1/cost-basis",
    "/api/v1/pnl",
    "cost_basis_fx_rate",
    "valuation_fx_rate",
    "calculation_version",
  ]) {
    assert.ok(apiSource.includes(value) || schemaSource.includes(value), `missing existing calculation boundary: ${value}`);
  }
});

test("TC-US-0002-C: transfer, idempotency, VOID, replay and restore expectations are executable contracts", () => {
  assert.match(testCases, /TC-US-0002-C \| US-0002-C/);

  for (const [caseId, expected] of Object.entries(EXPECTED_THEN)) {
    if (CASE_TO_TRACE[caseId] !== "TC-US-0002-C") continue;
    assert.deepEqual(getCase(caseId).then, expected, `${caseId} expected outputs must match the contract`);
  }
  for (const [caseId, expected] of Object.entries(EXPECTED_GIVEN)) {
    if (CASE_TO_TRACE[caseId] !== "TC-US-0002-C") continue;
    assert.deepEqual(getCase(caseId).given, expected, `${caseId} synthetic inputs must match the contract`);
  }

  // Every C-case expectation is bound, not just the subset that happened to
  // be referenced before.
  const transfer = getCase("C-PAIRED-TRANSFER-NEUTRALITY-001").then;
  assert.equal(transfer.source_activity_type, "TRANSFER_OUT");
  assert.equal(transfer.destination_activity_type, "TRANSFER_IN");
  assert.equal(transfer.source_direction, "DEBIT");
  assert.equal(transfer.destination_direction, "CREDIT");
  assert.equal(transfer.both_legs_are_external_flow_false, true);
  assert.equal(transfer.correction_preserves_both_original_legs, true);
  assert.equal(transfer.correction_reason_and_actor_are_auditable, true);

  const idempotency = getCase("C-IDEMPOTENCY-REPLAY-CONFLICT-001").then;
  assert.equal(idempotency.exact_replay_returns_original_activity, true);
  assert.equal(idempotency.exact_replay_creates_no_second_entry_audit_action_or_event, true);
  assert.equal(idempotency.changed_content_response_status, 409);
  assert.equal(idempotency.changed_content_error, "IDEMPOTENCY_KEY_CONFLICT");
  assert.equal(idempotency.different_account_is_independent, true);
  assert.equal(idempotency.replay_outputs_and_hash_are_deterministic_for_same_ledger_and_version, true);

  const correction = getCase("C-VOID-REPLAY-RESTORE-001").then;
  assert.equal(correction.original_activity_and_entries_are_preserved, true);
  assert.equal(correction.voided_activity_is_excluded_from_posted_balance_and_totals, true);
  assert.equal(correction.correction_has_reason_actor_trace_id_and_correlation_id, true);
  assert.equal(correction.restored_balances_equal_pre_backup_balances, true);
  assert.equal(correction.restored_totals_equal_pre_backup_totals, true);
  assert.equal(correction.restored_replay_hash_matches_same_logical_ledger_and_calculation_version, true);
  assert.equal(correction.restore_database_is_disposable_and_isolated, true);

  // The paired-transfer and idempotency rules are the owner's, not QA's.
  assert.match(ledgerPolicy, /source activity `TRANSFER_OUT`, DEBIT; destination activity `TRANSFER_IN`, CREDIT/);
  assert.match(ledgerPolicy, /both legs reference each other and both have `is_external_flow=false`/);
  assert.match(adrSource, /\*\*idempotency:\*\* `external_id` of deterministische account-scoped hash/);

  for (const value of [
    "paired_transaction_id",
    "is_external_flow",
    "external_id",
    "external_hash",
    "IDEMPOTENCY_KEY_CONFLICT",
    "replay_hash",
    "correction_reason",
    "VOID",
  ]) {
    assert.ok(apiSource.includes(value) || schemaSource.includes(value), `missing existing implementation boundary: ${value}`);
  }
});

test("TC-US-0002 decision inventory names unresolved owner choices instead of hiding policy", () => {
  const ids = fixture.unresolved_decisions.map(({ id }) => id);
  assert.deepEqual(ids, ["D-OVERDRAFT-01", "D-SHORT-01", "D-ROUNDING-01", "D-FEE-TAX-01", "D-COST-BASIS-01", "D-TRANSFER-01"]);
  for (const decision of fixture.unresolved_decisions) {
    assert.ok(decision.owner.length > 0);
    assert.ok(decision.question.endsWith("?") || decision.question.includes(";"));
    assert.ok(decision.test_impact.length > 20);
  }

  // Every decision the inventory names must have a recorded owner disposition,
  // and every case that depends on a decision must name it.
  assert.ok(ownerDecisionSource, "an owner record must carry a complete disposition table for every decision");
  for (const id of ids) {
    assert.ok(ownerDecisionStatuses.has(id), `owner records must carry a disposition for ${id}`);
  }
  const dependedOn = new Set(fixture.cases.flatMap((testCase) => testCase.decision_dependencies));
  for (const id of dependedOn) {
    assert.ok(ids.includes(id), `case dependency ${id} must appear in the unresolved decision inventory`);
  }
  assert.deepEqual(getCase("A-BUY-SELL-QUANTITY-001").decision_dependencies, ["D-OVERDRAFT-01", "D-SHORT-01"]);

  // The inventory records the owner's own disposition for each decision, and it
  // must match the owner record exactly. Without this the inventory could
  // silently over-report an open decision that the owner has already closed.
  for (const decision of fixture.unresolved_decisions) {
    assert.equal(
      decision.owner_disposition,
      ownerDecisionStatuses.get(decision.id),
      `${decision.id}: fixture disposition must match the owner record (${ownerDecisionSource})`,
    );
  }

  // Every decision the owner records still consider open must remain flagged in
  // the fixture inventory: the contract may never under-report open policy.
  for (const id of openOwnerDecisions) {
    assert.ok(ids.includes(id), `owner records list ${id} as not decided, so the fixture must keep flagging it`);
  }
});

test("TC-US-0002 executable contract starts RED until the owner decisions are approved", () => {
  // The approval flag must mirror the owner decision records, so flipping the
  // flag by hand can never make this contract green.
  assert.equal(
    fixture.owner_decisions_approved,
    openOwnerDecisions.length === 0,
    "fixture.owner_decisions_approved must mirror the owner decision records; it may only be true once no decision is open",
  );

  assert.equal(
    openOwnerDecisions.length,
    0,
    `W0-2 cannot be release-green: the owner records still list ${openOwnerDecisions.join(", ")} as not decided`,
  );
});
