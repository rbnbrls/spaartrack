type ForecastMode = "SCHEDULED_ONLY" | "BUDGET_ONLY" | "COMBINED";

type ScheduledTransaction = {
  id?: string;
  name?: string;
  amount?: string | number | null;
  currency_code?: string | null;
  frequency?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "CUSTOM" | string;
  next_due_on?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  is_active?: boolean;
};

type BudgetLine = {
  category_id?: string;
  category_name?: string;
  planned_amount?: string | number | null;
  rollover_amount?: string | number | null;
  currency_code?: string | null;
};

export type CashflowForecastInput = {
  mode: ForecastMode;
  startDate: string;
  horizonMonths: number;
  currencyCode: string;
  scheduledTransactions: ScheduledTransaction[];
  budgetLines: BudgetLine[];
};

function amount(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("INVALID_AMOUNT");
  return parsed;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dateAtMonth(startDate: string, monthIndex: number): Date {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + monthIndex);
  return date;
}

function dueInMonth(transaction: ScheduledTransaction, month: Date): boolean {
  if (transaction.is_active === false || !transaction.next_due_on) return false;
  const firstDue = new Date(`${transaction.next_due_on}T00:00:00.000Z`);
  const starts = transaction.starts_on ? new Date(`${transaction.starts_on}T00:00:00.000Z`) : null;
  const ends = transaction.ends_on ? new Date(`${transaction.ends_on}T00:00:00.000Z`) : null;
  const monthStart = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
  if (firstDue > monthEnd || (ends && ends < monthStart) || (starts && starts > monthEnd)) return false;
  const monthsSinceDue = (month.getUTCFullYear() - firstDue.getUTCFullYear()) * 12 + month.getUTCMonth() - firstDue.getUTCMonth();
  switch (transaction.frequency) {
    case "WEEKLY": return firstDue <= monthEnd;
    case "MONTHLY": return monthsSinceDue >= 0;
    case "QUARTERLY": return monthsSinceDue >= 0 && monthsSinceDue % 3 === 0;
    case "YEARLY": return monthsSinceDue >= 0 && monthsSinceDue % 12 === 0;
    default: return monthsSinceDue >= 0;
  }
}

export function buildCashflowForecast(input: CashflowForecastInput): Record<string, unknown> & { months: Array<Record<string, unknown>>; total_outflow: string } {
  if (!["SCHEDULED_ONLY", "BUDGET_ONLY", "COMBINED"].includes(input.mode)) throw new Error("INVALID_MODE");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || Number.isNaN(new Date(`${input.startDate}T00:00:00.000Z`).getTime())) throw new Error("INVALID_START_DATE");
  if (!Number.isInteger(input.horizonMonths) || input.horizonMonths < 1 || input.horizonMonths > 600) throw new Error("INVALID_HORIZON");
  if (!/^[A-Z]{3}$/.test(input.currencyCode)) throw new Error("INVALID_CURRENCY");
  const months = Array.from({ length: input.horizonMonths }, (_, index) => ({
    month: monthKey(dateAtMonth(input.startDate, index)),
    scheduled_outflow: 0,
    budget_outflow: 0,
    outflow: 0,
    scheduled_items: [] as string[],
  }));
  const budgetOutflow = input.budgetLines.reduce((sum, line) => {
    if (line.currency_code && line.currency_code !== input.currencyCode) throw new Error("CURRENCY_MISMATCH");
    return sum + amount(line.planned_amount) + amount(line.rollover_amount);
  }, 0);
  if (input.mode !== "SCHEDULED_ONLY") for (const month of months) month.budget_outflow = budgetOutflow;
  if (input.mode !== "BUDGET_ONLY") {
    for (const transaction of input.scheduledTransactions) {
      if (transaction.currency_code && transaction.currency_code !== input.currencyCode) throw new Error("CURRENCY_MISMATCH");
      const transactionAmount = amount(transaction.amount);
      months.forEach((month, index) => {
        if (dueInMonth(transaction, dateAtMonth(input.startDate, index))) {
          month.scheduled_outflow += transactionAmount;
          if (transaction.id) month.scheduled_items.push(transaction.id);
        }
      });
    }
  }
  for (const month of months) month.outflow = month.scheduled_outflow + month.budget_outflow;
  const total = months.reduce((sum, month) => sum + month.outflow, 0);
  return {
    mode: input.mode,
    currency_code: input.currencyCode,
    period_start: input.startDate,
    period_end: monthKey(dateAtMonth(input.startDate, input.horizonMonths - 1)),
    months: months.map((month) => ({ ...month, scheduled_outflow: month.scheduled_outflow.toFixed(2), budget_outflow: month.budget_outflow.toFixed(2), outflow: month.outflow.toFixed(2) })),
    total_outflow: total.toFixed(2),
    assumptions: {
      horizon_months: input.horizonMonths,
      scheduled_included: input.mode === "BUDGET_ONLY" ? 0 : input.scheduledTransactions.filter((item) => item.is_active !== false).length,
      budget_lines: input.mode === "SCHEDULED_ONLY" ? 0 : input.budgetLines.length,
      scheduled_rule: "active items, next_due_on and frequency within horizon",
      budget_rule: "planned_amount plus rollover_amount per budget month",
    },
    calculation_version: "cashflow-forecast-v1",
    source_of_truth: "canonical_ledger_read_models",
  };
}
