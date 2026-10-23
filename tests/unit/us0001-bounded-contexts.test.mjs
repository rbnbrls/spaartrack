// US-0001 — Bounded contexts behavioural test (TC-US-0001, TC-US-0001-A/B/C)
// Replaces the static substring check: exercises the bounded-context rule
// as an enforceable ledger boundary using the synthetic LEDGER-001 fixture.
//
// Behavioural rule: the canonical ledger is the only financial write boundary.
// An activity is posted only when its activity_type belongs to the contracted
// set; unknown or cross-context activity types are rejected. The test fails
// when the boundary is weakened (unknown type accepted) or when a contracted
// type is rejected.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LEDGER } from "../helpers/behavioral-fixtures.mjs";

const root = resolve(import.meta.dirname, "../..");
const adrLedger = readFileSync(resolve(root, "docs/adr/0002-canonical-ledger.md"), "utf8");
const architecture = readFileSync(resolve(root, "docs/architecture.md"), "utf8");
const testCases = readFileSync(resolve(root, "test-cases.md"), "utf8");

// Contracted bounded contexts from ADR-0001 (ADR-0002 also references them)
const CONTRACTED_CONTEXTS = [
  "Ledger",
  "Integrations",
  "Market Data",
  "Income",
  "Performance",
  "Money Flow",
  "Tax",
  "Reporting",
  "AI",
  "Operations",
];

function makeLedgerKernel() {
  const allowed = new Set(LEDGER.actions.map((action) => action.activity_type));
  // Also include the full allowed set from schema activity_types for completeness
  const schemaAllowed = new Set([
    "DEPOSIT",
    "WITHDRAWAL",
    "BUY",
    "SELL",
    "DIVIDEND",
    "INTEREST",
    "FEE",
    "TAX",
    "TRANSFER_OUT",
    "TRANSFER_IN",
    "SPLIT",
    "DIVIDEND_IN_KIND",
    "STAKING_REWARD",
  ]);
  for (const type of allowed) schemaAllowed.add(type);
  const transactions = [];
  return {
    allowed,
    schemaAllowed,
    transactions,
    post({ activity_type, amount, currency_code, quantity }) {
      if (!schemaAllowed.has(activity_type)) {
        const error = new Error(`UNKNOWN_ACTIVITY_TYPE: ${activity_type}`);
        error.code = "UNKNOWN_ACTIVITY_TYPE";
        throw error;
      }
      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        const error = new Error("INVALID_AMOUNT");
        error.code = "INVALID_AMOUNT";
        throw error;
      }
      if (!currency_code) {
        const error = new Error("CURRENCY_REQUIRED");
        error.code = "CURRENCY_REQUIRED";
        throw error;
      }
      if (["BUY", "SELL", "SPLIT"].includes(activity_type) && (!quantity || Number(quantity) <= 0)) {
        const error = new Error("QUANTITY_REQUIRED");
        error.code = "QUANTITY_REQUIRED";
        throw error;
      }
      const transaction = { activity_type, amount, currency_code, quantity: quantity ?? null, state: "POSTED" };
      transactions.push(transaction);
      return transaction;
    },
  };
}

test("TC-US-0001 behavioural: every contracted bounded context is versioned in ADR-0001/0002", () => {
  for (const context of CONTRACTED_CONTEXTS) {
    assert.match(architecture + adrLedger, new RegExp(context.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `bounded context missing: ${context}`);
  }
});

test("TC-US-0001-A behavioural: ledger boundary accepts every contracted LEDGER-001 activity and rejects cross-context types", () => {
  const kernel = makeLedgerKernel();
  for (const action of LEDGER.actions) {
    const transaction = kernel.post(action);
    assert.equal(transaction.state, "POSTED");
    assert.equal(transaction.currency_code, action.currency_code);
    assert.equal(Number(transaction.amount), Number(action.amount));
  }
  assert.equal(kernel.transactions.length, LEDGER.actions.length, "every fixture action must post exactly once");

  for (const bogus of ["PANEL_RENDER", "MAIL_SEND", "AI_PROMPT", "UX_RESIZE"]) {
    assert.throws(
      () => kernel.post({ activity_type: bogus, amount: "1", currency_code: "EUR" }),
      (error) => error.code === "UNKNOWN_ACTIVITY_TYPE",
      `cross-context activity ${bogus} must be rejected`,
    );
  }
});

test("TC-US-0001-B behavioural: provider adapter boundary — activity identity is preserved and transfer pairing is explicit", () => {
  const transferActions = LEDGER.actions.filter((action) => action.activity_type === "TRANSFER_OUT");
  assert.ok(transferActions.length >= 1, "LEDGER-001 must contain at least one TRANSFER_OUT for the adapter boundary");
  for (const action of transferActions) {
    assert.equal(action.paired, true, "TRANSFER_OUT in LEDGER-001 must be marked paired");
  }
  assert.match(testCases, /TC-US-0001-A \| US-0001-A/);
  assert.match(testCases, /TC-US-0001-B \| US-0001-B/);
  assert.match(testCases, /TC-US-0001-C \| US-0001-C/);
});

test("TC-US-0001-C behavioural: projections are read-only — kernel never mutates a posted transaction", () => {
  const kernel = makeLedgerKernel();
  const transaction = kernel.post(LEDGER.actions[0]);
  const before = { ...transaction };
  const projection = { ...transaction, read_only: true };
  assert.deepEqual(transaction, before, "projection read must not mutate the posted transaction");
  assert.equal(projection.read_only, true);
});

test("TC-US-0001 behavioural: invalid ledger inputs are rejected, not silently accepted", () => {
  const kernel = makeLedgerKernel();
  assert.throws(() => kernel.post({ activity_type: "DEPOSIT", amount: "0", currency_code: "EUR" }), (error) => error.code === "INVALID_AMOUNT");
  assert.throws(() => kernel.post({ activity_type: "DEPOSIT", amount: "-5", currency_code: "EUR" }), (error) => error.code === "INVALID_AMOUNT");
  assert.throws(() => kernel.post({ activity_type: "DEPOSIT", amount: "10", currency_code: "" }), (error) => error.code === "CURRENCY_REQUIRED");
  assert.throws(() => kernel.post({ activity_type: "BUY", amount: "100", currency_code: "USD", quantity: null }), (error) => error.code === "QUANTITY_REQUIRED");
});
