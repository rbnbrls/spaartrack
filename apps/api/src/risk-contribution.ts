export type RiskContributionHolding = {
  holdingId: string;
  name: string;
  category: string;
  portfolioWeight: number;
  riskScore: number;
};

function round(value: number): number {
  return Number(value.toFixed(10));
}

export function calculateRiskContributions(holdings: RiskContributionHolding[]): Record<string, unknown> & { holdings: Array<Record<string, unknown>>; categories: Array<Record<string, unknown>>; total_contribution_pct: number; methodology: string } {
  if (!holdings.length) throw new Error("NO_HOLDINGS");
  if (holdings.some((holding) => !holding.holdingId || !holding.name || !holding.category || !Number.isFinite(holding.portfolioWeight) || holding.portfolioWeight < 0 || !Number.isFinite(holding.riskScore) || holding.riskScore < 0)) throw new Error("INVALID_HOLDING");
  const raw = holdings.map((holding) => ({ holding, raw: holding.portfolioWeight * holding.riskScore }));
  const rawTotal = raw.reduce((sum, item) => sum + item.raw, 0);
  if (rawTotal <= 0) throw new Error("NO_RISK_EXPOSURE");
  const contributionFor = (value: number): number => round(value / rawTotal * 100);
  const resultHoldings = raw.map(({ holding, raw: value }) => ({ holding_id: holding.holdingId, name: holding.name, category: holding.category, portfolio_weight_pct: round(holding.portfolioWeight * 100), risk_score: holding.riskScore, contribution_pct: contributionFor(value) }));
  const categoryTotals = new Map<string, number>();
  for (const item of raw) categoryTotals.set(item.holding.category, (categoryTotals.get(item.holding.category) || 0) + item.raw);
  const categories = [...categoryTotals.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([category, value]) => ({ category, contribution_pct: contributionFor(value) }));
  return { holdings: resultHoldings, categories, total_contribution_pct: 100, methodology: "exposure-weighted-risk-proxy-v1" };
}
