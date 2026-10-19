export type LookthroughComponent = {
  holdingId: string | null;
  name: string;
  weight: number;
  resolved: boolean;
};

export type EtfHolding = {
  instrumentId: string;
  name: string;
  portfolioWeight: number;
  components: LookthroughComponent[];
};

type EtfExposureInput = {
  source: string;
  sourceVersion: string;
  asOf: string;
  holdings: EtfHolding[];
};

const round = (value: number): number => Math.round((value + Number.EPSILON) * 1e6) / 1e6;

export function calculateEtfExposure(input: EtfExposureInput): Record<string, unknown> & { overlap: Array<Record<string, unknown>>; unresolved_holdings: Array<Record<string, unknown>> } {
  if (!input.source || !input.sourceVersion || !/^\d{4}-\d{2}-\d{2}$/.test(input.asOf)) throw new Error("INVALID_LOOKTHROUGH_SOURCE");
  if (!input.holdings.length) throw new Error("ETF_HOLDINGS_REQUIRED");
  const exposures = new Map<string, { name: string; portfolioExposure: number; sourceCount: number }>();
  const unresolved: Array<Record<string, unknown>> = [];
  let totalWeight = 0;
  for (const holding of input.holdings) {
    if (!holding.instrumentId || !holding.name || !Number.isFinite(holding.portfolioWeight) || holding.portfolioWeight < 0) throw new Error("INVALID_ETF_HOLDING");
    if (!holding.components.length) throw new Error("LOOKTHROUGH_COMPONENTS_REQUIRED");
    const componentTotal = holding.components.reduce((sum, component) => sum + component.weight, 0);
    if (Math.abs(componentTotal - 1) > 0.000001) throw new Error("INVALID_LOOKTHROUGH_COMPONENT_TOTAL");
    totalWeight += holding.portfolioWeight;
    for (const component of holding.components) {
      if (!component.name || !Number.isFinite(component.weight) || component.weight < 0 || component.weight > 1) throw new Error("INVALID_LOOKTHROUGH_COMPONENT");
      if (!component.resolved || !component.holdingId) {
        unresolved.push({ etf_id: holding.instrumentId, etf_name: holding.name, name: component.name, weight_pct: round(component.weight * 100), portfolio_exposure_pct: round(holding.portfolioWeight * component.weight * 100), status: "UNRESOLVED" });
        continue;
      }
      const existing = exposures.get(component.holdingId) || { name: component.name, portfolioExposure: 0, sourceCount: 0 };
      existing.portfolioExposure += holding.portfolioWeight * component.weight;
      existing.sourceCount += 1;
      exposures.set(component.holdingId, existing);
    }
  }
  if (totalWeight <= 0) throw new Error("ETF_HOLDINGS_REQUIRED");
  const overlap = [...exposures.entries()]
    .map(([holdingId, value]) => ({ holding_id: holdingId, name: value.name, portfolio_exposure_pct: round(value.portfolioExposure / totalWeight * 100), source_count: value.sourceCount }))
    .sort((a, b) => Number(b.portfolio_exposure_pct) - Number(a.portfolio_exposure_pct));
  const unresolvedWeight = unresolved.reduce((sum, item) => sum + Number(item.portfolio_exposure_pct) / 100, 0);
  return {
    methodology: "etf-look-through-overlap-v1",
    source: input.source,
    source_version: input.sourceVersion,
    as_of: input.asOf,
    total_exposure_pct: 100,
    coverage_pct: round((1 - unresolvedWeight / totalWeight) * 100),
    overlap,
    unresolved_holdings: unresolved
  };
}
