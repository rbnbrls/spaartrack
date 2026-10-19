import test from "node:test";
import assert from "node:assert/strict";
import { buildTaxWorksheet } from "../../apps/api/src/tax-worksheet.ts";

test("US-1307 unit: builds a jurisdiction-specific worksheet with ownership and disclaimer", () => {
  const result = buildTaxWorksheet({
    jurisdiction: "NL",
    taxYear: 2026,
    ownerScope: "portfolio:synthetic-portfolio",
    income: [{ kind: "DIVIDEND", gross: 100, tax: 15, net: 85, currency: "EUR" }],
    gains: [{ taxableResult: 20, currency: "EUR", sourceActivityId: "sell-1" }]
  });
  assert.equal(result.ruleset, "NL-box-3-synthetic-v1");
  assert.equal(result.calculation_version, "tax-worksheet-v1");
  assert.equal(result.owner_scope, "portfolio:synthetic-portfolio");
  assert.match(result.disclaimer, /geen algemeen fiscaal advies/i);
  assert.equal(result.summary.total_income, "100.000000000000");
  assert.equal(result.summary.total_tax, "15.000000000000");
  assert.equal(result.summary.total_taxable_result, "20.000000000000");
});

test("US-1307 unit: supports UK period rules and rejects unsupported jurisdictions", () => {
  const result = buildTaxWorksheet({ jurisdiction: "UK", taxYear: 2026, ownerScope: "user:synthetic-user", income: [], gains: [] });
  assert.equal(result.ruleset, "UK-income-tax-synthetic-v1");
  assert.equal(result.period.start, "2026-04-06");
  assert.equal(result.period.end, "2027-04-05");
  assert.throws(() => buildTaxWorksheet({ jurisdiction: "US", taxYear: 2026, ownerScope: "user:x", income: [], gains: [] }), /UNSUPPORTED_TAX_WORKSHEET_JURISDICTION/);
});
