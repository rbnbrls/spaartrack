export type FiscalIncomeEvent = {
  id: string;
  eventType: string;
  status: string;
  paymentDate: string;
  grossAmount: number;
  taxAmount: number;
  feeAmount: number;
  netAmount: number;
  currency: string;
};

export type FiscalRealizedGain = {
  id: string;
  disposalDate: string;
  taxableResult: number;
  currency: string;
  sourceActivityId: string;
};

export type FiscalYearReportInput = {
  fiscalYear: number;
  jurisdiction: string;
  fiscalYearStartMonth: number;
  fiscalYearStartDay: number;
  baseCurrency: string;
  incomeEvents: FiscalIncomeEvent[];
  realizedGains: FiscalRealizedGain[];
};

const fixed = (value: number): string => value.toFixed(12);
const validDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));

function periodFor(input: FiscalYearReportInput): { start: string; end: string } {
  if (!Number.isInteger(input.fiscalYear) || input.fiscalYear < 1900 || input.fiscalYear > 2200 ||
      !/^[A-Z]{2,8}$/.test(input.jurisdiction) || !/^[A-Z]{3}$/.test(input.baseCurrency) ||
      !Number.isInteger(input.fiscalYearStartMonth) || input.fiscalYearStartMonth < 1 || input.fiscalYearStartMonth > 12 ||
      !Number.isInteger(input.fiscalYearStartDay) || input.fiscalYearStartDay < 1 || input.fiscalYearStartDay > 31) {
    throw new Error("INVALID_FISCAL_YEAR_CONFIGURATION");
  }
  const startDate = new Date(Date.UTC(input.fiscalYear, input.fiscalYearStartMonth - 1, input.fiscalYearStartDay));
  if (startDate.getUTCFullYear() !== input.fiscalYear || startDate.getUTCMonth() !== input.fiscalYearStartMonth - 1 || startDate.getUTCDate() !== input.fiscalYearStartDay) throw new Error("INVALID_FISCAL_YEAR_CONFIGURATION");
  const endDate = new Date(Date.UTC(input.fiscalYear + 1, input.fiscalYearStartMonth - 1, input.fiscalYearStartDay));
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  return { start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) };
}

export function buildFiscalYearReport(input: FiscalYearReportInput) {
  const period = periodFor(input);
  const inPeriod = (date: string): boolean => validDate(date) && date >= period.start && date <= period.end;
  const incomeItems = input.incomeEvents.filter((item) => item.status === "PAID" && inPeriod(item.paymentDate)).map((item) => {
    if (!item.id || !/^[A-Z]{3}$/.test(item.currency) || !Number.isFinite(item.grossAmount) || !Number.isFinite(item.taxAmount) || !Number.isFinite(item.feeAmount) || !Number.isFinite(item.netAmount)) throw new Error("INVALID_FISCAL_YEAR_INPUT");
    return { source_activity_id: item.id, event_type: item.eventType, payment_date: item.paymentDate, gross: fixed(item.grossAmount), tax: fixed(item.taxAmount), fees: fixed(item.feeAmount), net: fixed(item.netAmount), currency: item.currency };
  });
  const gainItems = input.realizedGains.filter((item) => inPeriod(item.disposalDate)).map((item) => {
    if (!item.id || !item.sourceActivityId || !/^[A-Z]{3}$/.test(item.currency) || !Number.isFinite(item.taxableResult)) throw new Error("INVALID_FISCAL_YEAR_INPUT");
    return { source_activity_id: item.sourceActivityId, realized_gain_id: item.id, disposal_date: item.disposalDate, taxable_result: fixed(item.taxableResult), currency: item.currency };
  });
  const sum = (items: Array<Record<string, string>>, key: string): number => items.reduce((total, item) => total + Number(item[key] || 0), 0);
  const incomeTotals = { gross: fixed(sum(incomeItems, "gross")), tax: fixed(sum(incomeItems, "tax")), fees: fixed(sum(incomeItems, "fees")), net: fixed(sum(incomeItems, "net")) };
  const gainsTotals = { taxable_result: fixed(sum(gainItems, "taxable_result")) };
  return {
    fiscal_year: input.fiscalYear,
    jurisdiction: input.jurisdiction,
    base_currency: input.baseCurrency,
    period,
    income: { items: incomeItems, totals: incomeTotals },
    realized_gains: { items: gainItems, totals: gainsTotals },
    total_taxable_result: fixed(Number(incomeTotals.gross) + Number(gainsTotals.taxable_result)),
    calculation_version: "fiscal-year-report-v1",
    source: "canonical-ledger-and-income-events",
    read_only: true
  };
}
