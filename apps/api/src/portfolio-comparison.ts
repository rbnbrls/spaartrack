export type ComparisonPortfolioInput = {
  id: string;
  name: string;
  currency: string;
  startValue: number;
  endValue: number;
  netCashFlow: number;
  allocation: Record<string, number>;
  risk: { volatilityPct: number | null; maxDrawdownPct: number | null; sharpe: number | null };
};

export type PortfolioComparisonInput = {
  periodStart: string;
  periodEnd: string;
  portfolios: ComparisonPortfolioInput[];
};

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function assertDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`INVALID_${label.toUpperCase()}`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`INVALID_${label.toUpperCase()}`);
}

function assertFinite(value: number, error: string): void {
  if (!Number.isFinite(value)) throw new Error(error);
}

function validateAllocation(allocation: Record<string, number>): number {
  const entries = Object.entries(allocation);
  if (!entries.length) throw new Error("INVALID_COMPARISON_ALLOCATION");
  const total = entries.reduce((sum, [key, value]) => {
    if (!key.trim() || typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new Error("INVALID_COMPARISON_ALLOCATION");
    return sum + value;
  }, 0);
  if (Math.abs(total - 1) > 0.000001) throw new Error("INVALID_COMPARISON_ALLOCATION");
  return total;
}

export function comparePortfolios(input: PortfolioComparisonInput) {
  assertDate(input.periodStart, "comparison_period_start");
  assertDate(input.periodEnd, "comparison_period_end");
  if (input.periodStart > input.periodEnd) throw new Error("INVALID_COMPARISON_PERIOD");
  if (input.portfolios.length < 2) throw new Error("COMPARISON_PORTFOLIOS_REQUIRED");
  const currencies = [...new Set(input.portfolios.map((portfolio) => String(portfolio.currency).trim().toUpperCase()))];
  if (currencies.length !== 1) throw new Error("COMPARISON_CURRENCY_MISMATCH");
  return {
    period: { start: input.periodStart, end: input.periodEnd }, currencies,
    portfolios: input.portfolios.map((portfolio) => {
      if (!portfolio.id || !portfolio.name.trim() || !currencies[0]) throw new Error("INVALID_COMPARISON_PORTFOLIO");
      assertFinite(portfolio.startValue, "INVALID_COMPARISON_PORTFOLIO");
      assertFinite(portfolio.endValue, "INVALID_COMPARISON_PORTFOLIO");
      assertFinite(portfolio.netCashFlow, "INVALID_COMPARISON_PORTFOLIO");
      if (portfolio.startValue < 0 || portfolio.endValue < 0) throw new Error("INVALID_COMPARISON_PORTFOLIO");
      const allocationTotal = validateAllocation(portfolio.allocation);
      const returnPct = portfolio.startValue > 0 ? ((portfolio.endValue - portfolio.startValue - portfolio.netCashFlow) / portfolio.startValue) * 100 : null;
      return {
        id: portfolio.id, name: portfolio.name, currency: currencies[0],
        values: { start: round(portfolio.startValue), end: round(portfolio.endValue), netCashFlow: round(portfolio.netCashFlow) },
        allocation: { ...portfolio.allocation, totalPct: round(allocationTotal * 100) },
        performance: { startValue: round(portfolio.startValue), endValue: round(portfolio.endValue), netCashFlow: round(portfolio.netCashFlow), returnPct: returnPct === null ? null : round(returnPct) }, risk: portfolio.risk,
      };
    }),
    calculationVersion: "portfolio-comparison-v1",
  };
}
