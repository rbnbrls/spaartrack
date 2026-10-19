import test from "node:test";
import assert from "node:assert/strict";
import { buildFiscalYearReport } from "../../apps/api/src/fiscal-year-report.ts";

test("US-1304 unit: fiscal-year configuration scopes taxable income and gains", () => {
  const result = buildFiscalYearReport({
    fiscalYear: 2026,
    jurisdiction: "NL",
    fiscalYearStartMonth: 1,
    fiscalYearStartDay: 1,
    baseCurrency: "EUR",
    incomeEvents: [
      { id: "income-2026", eventType: "DIVIDEND", status: "PAID", paymentDate: "2026-04-10", grossAmount: 100, taxAmount: 15, feeAmount: 1, netAmount: 84, currency: "EUR" },
      { id: "income-2025", eventType: "INTEREST", status: "PAID", paymentDate: "2025-12-31", grossAmount: 50, taxAmount: 5, feeAmount: 0, netAmount: 45, currency: "EUR" }
    ],
    realizedGains: [
      { id: "gain-2026", disposalDate: "2026-06-01", taxableResult: 55, currency: "EUR", sourceActivityId: "sell-2026" },
      { id: "gain-2025", disposalDate: "2025-06-01", taxableResult: 12, currency: "EUR", sourceActivityId: "sell-2025" }
    ]
  });

  assert.equal(result.fiscal_year, 2026);
  assert.equal(result.jurisdiction, "NL");
  assert.deepEqual(result.period, { start: "2026-01-01", end: "2026-12-31" });
  assert.equal(result.income.totals.gross, "100.000000000000");
  assert.equal(result.income.totals.tax, "15.000000000000");
  assert.equal(result.income.totals.net, "84.000000000000");
  assert.equal(result.realized_gains.totals.taxable_result, "55.000000000000");
  assert.equal(result.total_taxable_result, "155.000000000000");
  assert.deepEqual(result.income.items.map((item) => item.source_activity_id), ["income-2026"]);
  assert.deepEqual(result.realized_gains.items.map((item) => item.source_activity_id), ["sell-2026"]);
  assert.equal(result.calculation_version, "fiscal-year-report-v1");
  assert.equal(result.source, "canonical-ledger-and-income-events");
  assert.equal(result.read_only, true);
});

test("US-1304 unit: custom fiscal-year boundaries and invalid configuration are explicit", () => {
  const result = buildFiscalYearReport({
    fiscalYear: 2026,
    jurisdiction: "UK",
    fiscalYearStartMonth: 4,
    fiscalYearStartDay: 6,
    baseCurrency: "GBP",
    incomeEvents: [{ id: "income-apr", eventType: "DIVIDEND", status: "PAID", paymentDate: "2026-04-06", grossAmount: 10, taxAmount: 0, feeAmount: 0, netAmount: 10, currency: "GBP" }],
    realizedGains: []
  });
  assert.deepEqual(result.period, { start: "2026-04-06", end: "2027-04-05" });
  assert.throws(() => buildFiscalYearReport({ fiscalYear: 2026, jurisdiction: "NL", fiscalYearStartMonth: 13, fiscalYearStartDay: 1, baseCurrency: "EUR", incomeEvents: [], realizedGains: [] }), /INVALID_FISCAL_YEAR_CONFIGURATION/);
});
