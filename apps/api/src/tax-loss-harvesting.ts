export type TaxLossHarvestingLot = {
  acquisitionTransactionId: string;
  acquisitionDate: string;
  remainingQuantity: number;
  costBasis: number;
  marketValue: number;
  currency: string;
};

export type TaxLossHarvestingInput = { asOf: string; estimatedTaxRate: number; lots: TaxLossHarvestingLot[] };
const fixed = (value: number): string => value.toFixed(12);
const validDate = (value: string): boolean => { const parsed = new Date(`${value}T00:00:00.000Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; };
function holdingPeriod(acquisitionDate: string, asOf: string): "SHORT" | "LONG" { return (Date.parse(`${asOf}T00:00:00.000Z`) - Date.parse(`${acquisitionDate}T00:00:00.000Z`)) / 86_400_000 >= 365 ? "LONG" : "SHORT"; }

export function buildTaxLossHarvestingCandidates(input: TaxLossHarvestingInput) {
  if (!validDate(input.asOf) || !Number.isFinite(input.estimatedTaxRate) || input.estimatedTaxRate < 0 || input.estimatedTaxRate > 1) throw new Error("INVALID_TAX_LOSS_HARVESTING_INPUT");
  const candidates = input.lots.map((lot) => {
    if (!lot.acquisitionTransactionId || !validDate(lot.acquisitionDate) || lot.acquisitionDate > input.asOf || !Number.isFinite(lot.remainingQuantity) || lot.remainingQuantity <= 0 || !Number.isFinite(lot.costBasis) || lot.costBasis < 0 || !Number.isFinite(lot.marketValue) || lot.marketValue < 0 || !/^[A-Z]{3}$/.test(lot.currency)) throw new Error("INVALID_TAX_LOSS_HARVESTING_INPUT");
    const loss = lot.marketValue - lot.costBasis;
    if (loss >= -0.000000001) return null;
    const period = holdingPeriod(lot.acquisitionDate, input.asOf);
    return { acquisition_transaction_id: lot.acquisitionTransactionId, acquisition_date: lot.acquisitionDate, remaining_quantity: fixed(lot.remainingQuantity), cost_basis: fixed(lot.costBasis), market_value: fixed(lot.marketValue), unrealized_loss: fixed(loss), estimated_tax_rate: fixed(input.estimatedTaxRate), estimated_tax_saving: fixed(Math.abs(loss) * input.estimatedTaxRate), currency: lot.currency, holding_period: period, rationale: `${period === "LONG" ? "Long-term" : "Short-term"} open lot is below cost basis; harvesting could realize the loss, subject to applicable rules.` };
  }).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
  const sum = (key: "unrealized_loss" | "estimated_tax_saving") => candidates.reduce((total, item) => total + Number(item[key]), 0);
  return { as_of: input.asOf, candidates, totals: { unrealized_loss: fixed(sum("unrealized_loss")), estimated_tax_saving: fixed(sum("estimated_tax_saving")) }, calculation_version: "tax-loss-harvesting-v1", source: "canonical-ledger", read_only: true };
}
