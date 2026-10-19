export type RiskMetricsInput = {
  periodStart: string;
  periodEnd: string;
  portfolioReturns: Array<number | null | undefined>;
  benchmarkReturns: Array<number | null | undefined>;
  riskFreeAnnual: number;
  periodsPerYear: number;
};

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleVariance(values: number[], average = mean(values)): number {
  return values.length > 1 ? values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1) : 0;
}

export function calculateRiskMetrics(input: RiskMetricsInput): Record<string, unknown> & { observations: number; volatility_pct: number | null; max_drawdown_pct: number | null; beta: number | null; sharpe: number | null; sortino: number | null } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(input.periodEnd) || input.periodStart > input.periodEnd) throw new Error("INVALID_PERIOD");
  if (!Number.isInteger(input.periodsPerYear) || input.periodsPerYear < 1 || input.periodsPerYear > 366) throw new Error("INVALID_ANNUALIZATION");
  if (!Number.isFinite(input.riskFreeAnnual) || input.riskFreeAnnual < -1) throw new Error("INVALID_RISK_FREE");
  const pairs = input.portfolioReturns.map((portfolio, index) => ({ portfolio, benchmark: input.benchmarkReturns[index] })).filter((pair): pair is { portfolio: number; benchmark: number } => Number.isFinite(pair.portfolio) && Number.isFinite(pair.benchmark));
  const portfolio = pairs.map((pair) => pair.portfolio);
  const benchmark = pairs.map((pair) => pair.benchmark);
  const observations = portfolio.length;
  const riskFreePeriod = (1 + input.riskFreeAnnual) ** (1 / input.periodsPerYear) - 1;
  const portfolioMean = observations ? mean(portfolio) : 0;
  const benchmarkMean = observations ? mean(benchmark) : 0;
  const portfolioVariance = sampleVariance(portfolio, portfolioMean);
  const benchmarkVariance = sampleVariance(benchmark, benchmarkMean);
  const volatility = observations > 1 ? Math.sqrt(portfolioVariance) * Math.sqrt(input.periodsPerYear) * 100 : null;
  const beta = observations > 1 && benchmarkVariance > 0 ? portfolio.reduce((sum, value, index) => sum + (value - portfolioMean) * (benchmark[index] - benchmarkMean), 0) / (observations - 1) / benchmarkVariance : null;
  const excess = portfolio.map((value) => value - riskFreePeriod);
  const excessMean = observations ? mean(excess) : 0;
  const sharpe = observations > 1 && portfolioVariance > 0 ? excessMean / Math.sqrt(portfolioVariance) * Math.sqrt(input.periodsPerYear) : null;
  const downsideSquares = excess.map((value) => Math.min(0, value) ** 2);
  const downsideDeviation = observations ? Math.sqrt(mean(downsideSquares)) : 0;
  const sortino = observations > 1 && downsideDeviation > 0 ? excessMean / downsideDeviation * Math.sqrt(input.periodsPerYear) : null;
  let wealth = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (const value of portfolio) {
    wealth *= 1 + value;
    peak = Math.max(peak, wealth);
    maxDrawdown = Math.min(maxDrawdown, (wealth / peak - 1) * 100);
  }
  return {
    period_start: input.periodStart,
    period_end: input.periodEnd,
    observations,
    volatility_pct: volatility,
    max_drawdown_pct: observations ? maxDrawdown : null,
    beta,
    sharpe,
    sortino,
    assumptions: {
      benchmark: "synthetic benchmark returns",
      risk_free_annual: input.riskFreeAnnual,
      annualization_periods: input.periodsPerYear,
      missing_data_rule: "pairwise observations only; incomplete benchmark pairs are excluded",
    },
    calculation_version: "risk-metrics-v1",
  };
}
