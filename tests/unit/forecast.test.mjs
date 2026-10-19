import test from "node:test";
import assert from "node:assert/strict";
import { buildCashflowForecast } from "../../apps/api/src/forecast.ts";

const scheduled = [
  { id: "rent", name: "Synthetic rent", amount: "1200", currency_code: "EUR", frequency: "MONTHLY", next_due_on: "2026-01-05", is_active: true },
  { id: "insurance", name: "Synthetic insurance", amount: "120", currency_code: "EUR", frequency: "QUARTERLY", next_due_on: "2026-02-10", is_active: true },
  { id: "inactive", name: "Inactive item", amount: "999", currency_code: "EUR", frequency: "MONTHLY", next_due_on: "2026-01-01", is_active: false }
];
const budgets = [
  { category_id: "food", category_name: "Food", planned_amount: "300", rollover_amount: "25", currency_code: "EUR" },
  { category_id: "travel", category_name: "Travel", planned_amount: "100", rollover_amount: "0", currency_code: "EUR" }
];

test("US-1106-A unit: scheduled-only respects horizon, due dates and frequency", () => {
  const forecast = buildCashflowForecast({ mode: "SCHEDULED_ONLY", startDate: "2026-01-01", horizonMonths: 4, currencyCode: "EUR", scheduledTransactions: scheduled, budgetLines: [] });
  assert.deepEqual(forecast.months.map((month) => Number(month.outflow)), [1200, 1320, 1200, 1200]);
  assert.equal(forecast.total_outflow, "4920.00");
  assert.equal(forecast.assumptions.scheduled_included, 2);
  assert.equal(forecast.assumptions.horizon_months, 4);
});

test("US-1106-B unit: budget-only and combined preserve assumptions and totals", () => {
  const budget = buildCashflowForecast({ mode: "BUDGET_ONLY", startDate: "2026-01-01", horizonMonths: 2, currencyCode: "EUR", scheduledTransactions: [], budgetLines: budgets });
  assert.deepEqual(budget.months.map((month) => Number(month.outflow)), [425, 425]);
  assert.equal(budget.assumptions.budget_lines, 2);
  const combined = buildCashflowForecast({ mode: "COMBINED", startDate: "2026-01-01", horizonMonths: 2, currencyCode: "EUR", scheduledTransactions: scheduled, budgetLines: budgets });
  assert.deepEqual(combined.months.map((month) => Number(month.outflow)), [1625, 1745]);
  assert.equal(combined.calculation_version, "cashflow-forecast-v1");
  assert.equal(combined.source_of_truth, "canonical_ledger_read_models");
});

test("US-1106 unit: invalid horizon and currency are rejected", () => {
  assert.throws(() => buildCashflowForecast({ mode: "COMBINED", startDate: "2026-01-01", horizonMonths: 0, currencyCode: "EUR", scheduledTransactions: [], budgetLines: [] }), /INVALID_HORIZON/);
  assert.throws(() => buildCashflowForecast({ mode: "COMBINED", startDate: "2026-01-01", horizonMonths: 1, currencyCode: "EURO", scheduledTransactions: [], budgetLines: [] }), /INVALID_CURRENCY/);
});
