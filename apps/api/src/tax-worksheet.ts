type WorksheetIncome = { kind: string; gross: number; tax: number; net: number; currency: string };
type WorksheetGain = { taxableResult: number; currency: string; sourceActivityId: string };
export type TaxWorksheetInput = { jurisdiction: string; taxYear: number; ownerScope: string; income: WorksheetIncome[]; gains: WorksheetGain[] };

const fixed = (value: number): string => value.toFixed(12);
const disclaimer = "Dit is een synthetische worksheet en geen algemeen fiscaal advies.";

function validateMoney(value: number, currency: string): void {
  if (!Number.isFinite(value) || !/^[A-Z]{3}$/.test(currency)) throw new Error("INVALID_TAX_WORKSHEET_INPUT");
}

export function buildTaxWorksheet(input: TaxWorksheetInput) {
  const jurisdiction = input.jurisdiction.trim().toUpperCase();
  if (!Number.isInteger(input.taxYear) || input.taxYear < 2000 || input.taxYear > 2100 || !input.ownerScope.trim() || !Array.isArray(input.income) || !Array.isArray(input.gains)) throw new Error("INVALID_TAX_WORKSHEET_INPUT");
  const supported = jurisdiction === "NL" || jurisdiction === "UK";
  if (!supported) throw new Error("UNSUPPORTED_TAX_WORKSHEET_JURISDICTION");
  const period = jurisdiction === "NL"
    ? { start: `${input.taxYear}-01-01`, end: `${input.taxYear}-12-31` }
    : { start: `${input.taxYear}-04-06`, end: `${input.taxYear + 1}-04-05` };
  for (const item of input.income) {
    if (!item.kind || !Number.isFinite(item.gross) || !Number.isFinite(item.tax) || !Number.isFinite(item.net) || item.gross < 0 || item.tax < 0 || item.net < 0 || !/^[A-Z]{3}$/.test(item.currency)) throw new Error("INVALID_TAX_WORKSHEET_INPUT");
  }
  for (const item of input.gains) {
    if (!item.sourceActivityId || !Number.isFinite(item.taxableResult) || !/^[A-Z]{3}$/.test(item.currency)) throw new Error("INVALID_TAX_WORKSHEET_INPUT");
  }
  const totalIncome = input.income.reduce((sum, item) => sum + item.gross, 0);
  const totalTax = input.income.reduce((sum, item) => sum + item.tax, 0);
  const totalNet = input.income.reduce((sum, item) => sum + item.net, 0);
  const totalTaxableResult = input.gains.reduce((sum, item) => sum + item.taxableResult, 0);
  return {
    jurisdiction,
    tax_year: input.taxYear,
    period,
    owner_scope: input.ownerScope,
    ruleset: jurisdiction === "NL" ? "NL-box-3-synthetic-v1" : "UK-income-tax-synthetic-v1",
    ruleset_version: "2026.10",
    disclaimer,
    summary: { total_income: fixed(totalIncome), total_tax: fixed(totalTax), total_net: fixed(totalNet), total_taxable_result: fixed(totalTaxableResult) },
    income: input.income,
    gains: input.gains,
    calculation_version: "tax-worksheet-v1",
    source: "canonical-ledger-and-income-events",
    read_only: true
  };
}
