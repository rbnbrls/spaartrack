export type BacktestPricePoint = { date: string; prices: Record<string, number> };
export type BacktestCashflow = { date: string; amount: number };
export type WhatIfBacktestInput = {
  periodStart: string;
  periodEnd: string;
  allocations: Record<string, number>;
  initialCapital: number;
  priceSeries: BacktestPricePoint[];
  cashflows?: BacktestCashflow[];
  costs?: { percentage?: number; fixed?: number };
  assumptions?: Record<string, unknown>;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));

function validateDate(value: string, error: string): void {
  if (!DATE.test(value)) throw new Error(error);
}

export function runWhatIfBacktest(input: WhatIfBacktestInput) {
  validateDate(input.periodStart, "INVALID_BACKTEST_PERIOD");
  validateDate(input.periodEnd, "INVALID_BACKTEST_PERIOD");
  if (input.periodStart >= input.periodEnd) throw new Error("INVALID_BACKTEST_PERIOD");
  if (!Number.isFinite(input.initialCapital) || input.initialCapital <= 0) throw new Error("INVALID_INITIAL_CAPITAL");

  const allocationEntries = Object.entries(input.allocations || {});
  const allocationTotal = allocationEntries.reduce((sum, [, value]) => sum + Number(value), 0);
  if (!allocationEntries.length || allocationEntries.some(([, value]) => !Number.isFinite(value) || value < 0) || Math.abs(allocationTotal - 1) > 0.000001) throw new Error("ALLOCATIONS_MUST_EQUAL_100");

  const priceSeries = [...(input.priceSeries || [])].sort((left, right) => left.date.localeCompare(right.date));
  if (priceSeries.some((point) => !DATE.test(point.date))) throw new Error("INVALID_BACKTEST_PRICE_DATE");
  const symbols = allocationEntries.map(([symbol]) => symbol);
  for (const point of priceSeries) {
    validateDate(point.date, "INVALID_BACKTEST_PRICE_DATE");
    for (const symbol of symbols) if (!Number.isFinite(point.prices[symbol]) || point.prices[symbol] <= 0) throw new Error("INVALID_BACKTEST_PRICE");
  }
  if (priceSeries.length < 2 || priceSeries[0].date !== input.periodStart || priceSeries.at(-1)?.date !== input.periodEnd) throw new Error("BACKTEST_BOUNDARY_PRICES_REQUIRED");

  const costs = { percentage: Number(input.costs?.percentage || 0), fixed: Number(input.costs?.fixed || 0) };
  if (!Number.isFinite(costs.percentage) || costs.percentage < 0 || !Number.isFinite(costs.fixed) || costs.fixed < 0) throw new Error("INVALID_BACKTEST_COSTS");
  const cashflows = [...(input.cashflows || [])].map((flow) => ({ date: flow.date, amount: Number(flow.amount) })).sort((left, right) => left.date.localeCompare(right.date));
  if (cashflows.some((flow) => !DATE.test(flow.date) || flow.date < input.periodStart || flow.date > input.periodEnd || !Number.isFinite(flow.amount))) throw new Error("INVALID_BACKTEST_CASHFLOW");

  const units: Record<string, number> = {};
  let totalCosts = 0;
  const invest = (amount: number, prices: Record<string, number>) => {
    const fee = amount * costs.percentage + costs.fixed;
    totalCosts += fee;
    const net = amount - fee;
    for (const [symbol, allocation] of allocationEntries) units[symbol] = (units[symbol] || 0) + net * allocation / prices[symbol];
  };
  invest(input.initialCapital, priceSeries[0].prices);
  const observations = priceSeries.map((point) => {
    for (const flow of cashflows.filter((candidate) => candidate.date === point.date)) invest(flow.amount, point.prices);
    const value = symbols.reduce((sum, symbol) => sum + units[symbol] * point.prices[symbol], 0);
    return { date: point.date, value: round(value), prices: { ...point.prices } };
  });
  const startValue = observations[0].value;
  const finalValue = observations.at(-1)?.value || 0;
  const netCashflow = cashflows.reduce((sum, flow) => sum + flow.amount, 0);
  return {
    period: { start: input.periodStart, end: input.periodEnd },
    assumptions: { ...(input.assumptions || {}) },
    allocations: Object.fromEntries(allocationEntries),
    input_prices: priceSeries.map((point) => ({ date: point.date, prices: { ...point.prices } })),
    costs: { percentage: costs.percentage, fixed: costs.fixed },
    cashflows: cashflows.map((flow) => ({ ...flow })),
    observations,
    result: { start_value: startValue, final_value: finalValue, net_cashflow: round(netCashflow), total_costs: round(totalCosts), return_pct: round(startValue > 0 ? (finalValue - startValue - netCashflow) / startValue * 100 : 0) },
    calculation_version: "what-if-backtest-v1",
  };
}
