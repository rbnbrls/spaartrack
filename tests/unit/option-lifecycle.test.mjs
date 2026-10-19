import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planOptionLifecycleEvent, summarizeOptionPosition } from "../../apps/api/src/option-lifecycle.ts";

const fixture = JSON.parse(readFileSync(new URL("../../fixtures/SPECIAL-001.json", import.meta.url), "utf8"));
const option = fixture.option;

const callPremium = option.expected.theoretical_price;

function baseInput(overrides = {}) {
  return {
    event_type: "OPEN",
    quantity: 1,
    premium: callPremium,
    contract_multiplier: option.contract.contract_multiplier,
    option_type: option.contract.option_type,
    occurred_at: "2026-10-18T10:00:00.000Z",
    effective_date: "2026-10-18",
    currency_code: "EUR",
    open_lots: [],
    ...overrides
  };
}

function openLot(transactionId, quantity, unitCost, effectiveDate = "2026-10-18") {
  return { transaction_id: transactionId, quantity, unit_cost: unitCost, effective_date: effectiveDate };
}

test("US-1405-A unit: OPEN plans contract quantity, premium and cost basis through the ledger plan", () => {
  const plan = planOptionLifecycleEvent(baseInput({ quantity: 2 }));
  assert.equal(plan.event_type, "OPEN");
  assert.equal(plan.option_type, "CALL");
  assert.equal(plan.quantity, "2.000000000000");
  assert.equal(plan.contract_multiplier, "100.000000000000");
  assert.equal(plan.premium_per_contract, "8.272733654887");
  assert.equal(plan.gross_premium_amount, "1654.546730977400");
  assert.equal(plan.consumed_basis, "0.000000000000");
  assert.equal(plan.realized_pnl, "0.000000000000");
  assert.equal(plan.remaining_quantity, "2.000000000000");
  assert.equal(plan.remaining_basis, "1654.546730977400");
  assert.equal(plan.ledger_plan.length, 1);
  const leg = plan.ledger_plan[0];
  assert.equal(leg.leg, "OPTION");
  assert.equal(leg.activity_type, "BUY");
  assert.equal(leg.direction, "DEBIT");
  assert.equal(leg.entry_kind, "POSITION");
  assert.equal(leg.quantity, "2.000000000000");
  assert.equal(leg.unit_price, "8.272733654887");
  assert.equal(leg.amount, "1654.546730977400");
  assert.equal(leg.currency_code, "EUR");
  assert.equal(plan.underlying_settlement, null);
  assert.equal(plan.calculation_version, "option-lifecycle-v1");
  assert.equal(plan.ledger_boundary, "canonical-ledger-application-command");
  assert.equal(plan.read_only, false);

  const withFees = planOptionLifecycleEvent(baseInput({ quantity: 1, fee_amount: 2, tax_amount: 1 }));
  assert.equal(withFees.ledger_plan[0].fee_amount, "2.000000000000");
  assert.equal(withFees.ledger_plan[0].tax_amount, "1.000000000000");
  assert.equal(withFees.remaining_basis, "830.273365488700");
});

test("US-1405-B unit: partial CLOSE consumes FIFO lots and reports deterministic P&L", () => {
  const lots = [openLot("tx-open-1", 2, 827.2733654887, "2026-01-05"), openLot("tx-open-2", 1, 900, "2026-02-01")];
  const plan = planOptionLifecycleEvent(baseInput({ event_type: "CLOSE", quantity: 2, premium: "12", open_lots: lots }));
  assert.equal(plan.requested_event_type, "CLOSE");
  assert.equal(plan.event_type, "PARTIAL_CLOSE");
  assert.equal(plan.quantity, "2.000000000000");
  assert.equal(plan.gross_premium_amount, "2400.000000000000");
  assert.equal(plan.consumed_lots.length, 1);
  assert.equal(plan.consumed_lots[0].transaction_id, "tx-open-1");
  assert.equal(plan.consumed_lots[0].quantity, "2.000000000000");
  assert.equal(plan.consumed_lots[0].cost_basis, "1654.546730977400");
  assert.equal(plan.consumed_basis, "1654.546730977400");
  assert.equal(plan.realized_pnl, "745.453269022600");
  assert.equal(plan.remaining_quantity, "1.000000000000");
  assert.equal(plan.remaining_basis, "900.000000000000");
  assert.equal(plan.ledger_plan[0].activity_type, "SELL");
  assert.equal(plan.ledger_plan[0].direction, "CREDIT");
  assert.equal(plan.ledger_plan[0].amount, "2400.000000000000");

  const full = planOptionLifecycleEvent(baseInput({ event_type: "CLOSE", quantity: 1, premium: "12", open_lots: [openLot("tx-open-1", 1, 827.2733654887)] }));
  assert.equal(full.event_type, "CLOSE");
  assert.equal(full.remaining_quantity, "0.000000000000");
  assert.equal(full.remaining_basis, "0.000000000000");
  assert.equal(full.realized_pnl, "372.726634511300");
});

test("US-1405-B unit: ROLL closes the source leg and opens the destination leg atomically", () => {
  const plan = planOptionLifecycleEvent(baseInput({
    event_type: "ROLL",
    quantity: 1,
    premium: "11",
    open_lots: [openLot("tx-open-1", 1, 827.2733654887)],
    destination_option_instrument_id: "11111111-2222-3333-4444-555555555555",
    destination_premium: "9",
    roll_group_id: "roll-synthetic-1405"
  }));
  assert.equal(plan.event_type, "ROLL");
  assert.equal(plan.realized_pnl, "272.726634511300");
  assert.equal(plan.remaining_quantity, "0.000000000000");
  assert.equal(plan.ledger_plan.length, 2);
  assert.equal(plan.ledger_plan[0].leg, "OPTION");
  assert.equal(plan.ledger_plan[0].activity_type, "SELL");
  assert.equal(plan.ledger_plan[0].amount, "1100.000000000000");
  assert.equal(plan.ledger_plan[1].leg, "DESTINATION_OPTION");
  assert.equal(plan.ledger_plan[1].activity_type, "BUY");
  assert.equal(plan.ledger_plan[1].direction, "DEBIT");
  assert.equal(plan.ledger_plan[1].amount, "900.000000000000");
  assert.equal(plan.destination.option_instrument_id, "11111111-2222-3333-4444-555555555555");
  assert.equal(plan.roll_group_id, "roll-synthetic-1405");
  assert.throws(() => planOptionLifecycleEvent(baseInput({ event_type: "ROLL", premium: "11", open_lots: [openLot("tx-open-1", 1, 827.2733654887)] })), /ROLL_DESTINATION_REQUIRED/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ event_type: "ROLL", premium: "11", open_lots: [openLot("tx-open-1", 1, 827.2733654887)], destination_option_instrument_id: "11111111-2222-3333-4444-555555555555" })), /INVALID_OPTION_LIFECYCLE_INPUT/);
});

test("US-1405-C unit: CALL EXERCISE settles the underlying at strike and transfers the premium basis", () => {
  const plan = planOptionLifecycleEvent(baseInput({
    event_type: "EXERCISE",
    quantity: 1,
    premium: undefined,
    strike_price: 100,
    open_lots: [openLot("tx-open-1", 1, 827.2733654887)]
  }));
  assert.equal(plan.event_type, "EXERCISE");
  assert.equal(plan.realized_pnl, "0.000000000000");
  assert.equal(plan.consumed_basis, "827.273365488700");
  assert.equal(plan.remaining_quantity, "0.000000000000");
  assert.equal(plan.ledger_plan.length, 2);
  assert.equal(plan.ledger_plan[0].leg, "OPTION");
  assert.equal(plan.ledger_plan[0].activity_type, "SELL");
  assert.equal(plan.ledger_plan[0].amount, "0.000000000000");
  assert.equal(plan.ledger_plan[1].leg, "UNDERLYING");
  assert.equal(plan.ledger_plan[1].activity_type, "BUY");
  assert.equal(plan.ledger_plan[1].direction, "DEBIT");
  assert.equal(plan.ledger_plan[1].quantity, "100.000000000000");
  assert.equal(plan.ledger_plan[1].unit_price, "100.000000000000");
  assert.equal(plan.ledger_plan[1].amount, "10000.000000000000");
  assert.equal(plan.ledger_plan[1].fee_amount, "827.273365488700");
  assert.equal(plan.underlying_settlement.activity_type, "BUY");
  assert.equal(plan.underlying_settlement.premium_basis_transfer, "827.273365488700");
});

test("US-1405-C unit: PUT EXERCISE and ASSIGNMENT deliver underlying shares at strike without double counting", () => {
  const putExercise = planOptionLifecycleEvent(baseInput({
    event_type: "EXERCISE",
    option_type: "PUT",
    quantity: 1,
    premium: undefined,
    strike_price: 100,
    open_lots: [openLot("tx-open-1", 1, 827.2733654887)]
  }));
  assert.equal(putExercise.ledger_plan[1].activity_type, "SELL");
  assert.equal(putExercise.ledger_plan[1].direction, "CREDIT");
  assert.equal(putExercise.ledger_plan[1].quantity, "100.000000000000");
  assert.equal(putExercise.ledger_plan[1].amount, "10000.000000000000");
  assert.equal(putExercise.ledger_plan[1].fee_amount, "827.273365488700");
  assert.equal(putExercise.realized_pnl, "0.000000000000");

  const assigned = planOptionLifecycleEvent(baseInput({
    event_type: "ASSIGNMENT",
    quantity: 1,
    premium: undefined,
    strike_price: 100,
    open_lots: [openLot("tx-open-1", 1, 827.2733654887)]
  }));
  assert.equal(assigned.event_type, "ASSIGNMENT");
  assert.equal(assigned.ledger_plan[1].activity_type, "BUY");
  assert.equal(assigned.underlying_settlement.event_type, "ASSIGNMENT");
});

test("US-1405-C unit: EXPIRY removes the contract without cash movement and realizes the lost premium", () => {
  const plan = planOptionLifecycleEvent(baseInput({
    event_type: "EXPIRY",
    quantity: 1,
    premium: undefined,
    open_lots: [openLot("tx-open-1", 1, 827.2733654887)]
  }));
  assert.equal(plan.event_type, "EXPIRY");
  assert.equal(plan.realized_pnl, "-827.273365488700");
  assert.equal(plan.ledger_plan.length, 1);
  assert.equal(plan.ledger_plan[0].activity_type, "SELL");
  assert.equal(plan.ledger_plan[0].amount, "0.000000000000");
  assert.equal(plan.underlying_settlement, null);
  assert.equal(plan.remaining_quantity, "0.000000000000");
});

test("US-1405 unit: summarizeOptionPosition derives remaining contracts and basis from ledger lots", () => {
  const lots = [openLot("tx-open-1", 2, 827.2733654887, "2026-01-05"), openLot("tx-open-2", 3, 900, "2026-02-01")];
  const summary = summarizeOptionPosition({ open_lots: lots });
  assert.equal(summary.remaining_quantity, "5.000000000000");
  assert.equal(summary.remaining_basis, "4354.546730977400");
  assert.equal(summary.open_lot_count, 2);
  assert.equal(summary.calculation_version, "option-position-v1");
  assert.equal(summary.read_only, true);
  const plan = planOptionLifecycleEvent({
    event_type: "CLOSE",
    quantity: 1,
    premium: "12",
    contract_multiplier: 100,
    option_type: "CALL",
    occurred_at: "2026-10-18T10:00:00.000Z",
    effective_date: "2026-10-18",
    currency_code: "EUR",
    open_lots: lots
  });
  assert.equal(plan.realized_pnl, "372.726634511300");
  assert.equal(plan.remaining_quantity, "4.000000000000");
  assert.equal(plan.remaining_basis, "3527.273365488700");
});

test("US-1405 unit: invalid lifecycle input is rejected before any ledger plan is produced", () => {
  assert.throws(() => planOptionLifecycleEvent(baseInput({ event_type: "STRADDLE" })), /INVALID_OPTION_LIFECYCLE_INPUT/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ quantity: 0 })), /INVALID_OPTION_LIFECYCLE_INPUT/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ quantity: -2 })), /INVALID_OPTION_LIFECYCLE_INPUT/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ quantity: "abc" })), /INVALID_OPTION_LIFECYCLE_INPUT/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ premium: undefined })), /INVALID_OPTION_LIFECYCLE_INPUT/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ premium: 0 })), /INVALID_OPTION_LIFECYCLE_INPUT/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ premium: -1 })), /INVALID_OPTION_LIFECYCLE_INPUT/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ contract_multiplier: 0 })), /INVALID_OPTION_LIFECYCLE_INPUT/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ occurred_at: "not-a-date" })), /INVALID_OPTION_LIFECYCLE_INPUT/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ effective_date: "18-10-2026" })), /INVALID_OPTION_LIFECYCLE_INPUT/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ currency_code: "EURO" })), /INVALID_OPTION_LIFECYCLE_INPUT/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ event_type: "CLOSE", open_lots: [] })), /OPTION_QUANTITY_NOT_AVAILABLE/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ event_type: "CLOSE", quantity: 2, open_lots: [openLot("tx-open-1", 1, 827.2733654887)] })), /OPTION_QUANTITY_NOT_AVAILABLE/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ event_type: "EXERCISE", premium: undefined, open_lots: [openLot("tx-open-1", 1, 827.2733654887)] })), /INVALID_OPTION_LIFECYCLE_INPUT/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ event_type: "EXERCISE", strike_price: 0, premium: undefined, open_lots: [openLot("tx-open-1", 1, 827.2733654887)] })), /INVALID_OPTION_LIFECYCLE_INPUT/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ event_type: "EXERCISE", strike_price: 100, premium: undefined, option_type: "STRADDLE", open_lots: [openLot("tx-open-1", 1, 827.2733654887)] })), /INVALID_OPTION_LIFECYCLE_INPUT/);
  assert.throws(() => planOptionLifecycleEvent(baseInput({ event_type: "OPEN", open_lots: [{ transaction_id: "", quantity: 1, unit_cost: 1, effective_date: "2026-10-18" }] })), /INVALID_OPTION_LIFECYCLE_INPUT/);
});
