import test from "node:test";
import assert from "node:assert/strict";
import { calculateShareWeightedBalance, validateGoalFundingAllocations } from "../../apps/api/src/goal-funding.ts";

const portfolioId = "11111111-1111-4111-8111-111111111111";
const accountA = "22222222-2222-4222-8222-222222222222";
const accountB = "33333333-3333-4333-8333-333333333333";
const account = (id, overrides = {}) => ({ id, portfolio_id: portfolioId, status: "ACTIVE", base_currency_code: "EUR", ...overrides });

test("US-1105-A unit: funding shares validate scope, currency and <=100%", () => {
  const result = validateGoalFundingAllocations([
    { financial_account_id: accountA, funding_percentage: "60" },
    { financial_account_id: accountB, funding_percentage: "40" }
  ], [account(accountA), account(accountB)], portfolioId, "EUR");
  assert.equal(result.total_percentage, 100);
  assert.deepEqual(result.allocations[0], { financial_account_id: accountA, funding_percentage: "60.0000" });
});

test("US-1105-A unit: duplicate, hidden, mismatched currency and over-allocation fail", () => {
  assert.throws(() => validateGoalFundingAllocations([
    { financial_account_id: accountA, funding_percentage: "60" },
    { financial_account_id: accountA, funding_percentage: "40" }
  ], [account(accountA)], portfolioId, "EUR"), /DUPLICATE/);
  assert.throws(() => validateGoalFundingAllocations([{ financial_account_id: accountA, funding_percentage: "1" }], [account(accountA, { status: "HIDDEN" })], portfolioId, "EUR"), /UNAVAILABLE/);
  assert.throws(() => validateGoalFundingAllocations([{ financial_account_id: accountA, funding_percentage: "1" }], [account(accountA, { base_currency_code: "USD" })], portfolioId, "EUR"), /CURRENCY/);
  assert.throws(() => validateGoalFundingAllocations([
    { financial_account_id: accountA, funding_percentage: "75" },
    { financial_account_id: accountB, funding_percentage: "25.01" }
  ], [account(accountA), account(accountB)], portfolioId, "EUR"), /OVERALLOCATED/);
});

test("US-1105-B unit: balance is share-weighted from account projections", () => {
  const balances = new Map([[accountA, 1000], [accountB, 2500]]);
  assert.equal(calculateShareWeightedBalance([
    { financial_account_id: accountA, funding_percentage: "60" },
    { financial_account_id: accountB, funding_percentage: "40" }
  ], balances), 1600);
});
