type Holding = { key: string; label: string; currentValue: number };
type Target = { key: string; label: string; targetPercentage: number };

export function calculateDriftRebalance(input: {
  dimension: string;
  portfolioValue: number;
  holdings: Holding[];
  targets: Target[];
  cashAvailable?: number;
}) {
  const portfolioValue = Number(input.portfolioValue);
  if (!Number.isFinite(portfolioValue) || portfolioValue <= 0) throw new Error("INVALID_REBALANCE_PORTFOLIO_VALUE");
  const targets = input.targets || [];
  const targetTotal = targets.reduce((sum, target) => sum + Number(target.targetPercentage), 0);
  if (!targets.length || Math.abs(targetTotal - 100) > 0.0001) throw new Error("ALLOCATION_TARGET_TOTAL_MUST_EQUAL_100");
  const current = new Map((input.holdings || []).map((holding) => [holding.key, holding]));
  const keys = new Set([...current.keys(), ...targets.map((target) => target.key)]);
  const targetByKey = new Map(targets.map((target) => [target.key, target]));
  const suggestions = [...keys].map((key) => {
    const holding = current.get(key);
    const target = targetByKey.get(key) || { key, label: holding?.label || key, targetPercentage: 0 };
    const currentValue = Number(holding?.currentValue || 0);
    const targetValue = portfolioValue * Number(target.targetPercentage) / 100;
    const tradeValue = targetValue - currentValue;
    return {
      key, label: target.label, current_percentage: round(currentValue / portfolioValue * 100),
      target_percentage: round(Number(target.targetPercentage)),
      drift_percentage_points: round(currentValue / portfolioValue * 100 - Number(target.targetPercentage)),
      current_value: round(currentValue), target_value: round(targetValue), trade_value: round(tradeValue),
      action: Math.abs(tradeValue) < 0.01 ? "HOLD" : tradeValue > 0 ? "BUY" : "SELL",
    } as const;
  }).sort((left, right) => Math.abs(right.drift_percentage_points) - Math.abs(left.drift_percentage_points) || left.key.localeCompare(right.key));
  const requiredCash = round(suggestions.reduce((sum, suggestion) => sum + Math.max(0, suggestion.trade_value), 0));
  const cashAvailable = round(Number(input.cashAvailable || 0));
  return {
    dimension: String(input.dimension || "").trim().toUpperCase(), suggestions,
    required_cash: requiredCash, cash_available: cashAvailable, cash_shortfall: round(Math.max(0, requiredCash - cashAvailable)),
    trade_assumptions: { execution: "indicative", fees_included: false, taxes_included: false, prices_as_of: "snapshot", no_ledger_mutation: true },
    calculation_version: "drift-rebalance-v1", source: "position_snapshot + allocation_target",
  };
}

function round(value: number): number { return Math.round((value + Number.EPSILON) * 10000) / 10000; }
