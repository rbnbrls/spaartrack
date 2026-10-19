import test from "node:test";
import assert from "node:assert/strict";
import { calculateRiskContributions } from "../../apps/api/src/risk-contribution.ts";

const fixture = [
  { holdingId: "equity-a", name: "Synthetic Equity A", category: "EQUITY", portfolioWeight: 0.6, riskScore: 1 },
  { holdingId: "bond-a", name: "Synthetic Bond A", category: "FIXED_INCOME", portfolioWeight: 0.3, riskScore: 0.5 },
  { holdingId: "cash-a", name: "Synthetic Cash", category: "CASH", portfolioWeight: 0.1, riskScore: 0.1 },
];

test("US-1202 unit: holding contributions use explicit exposure-weighted risk proxy and total 100%", () => {
  const result = calculateRiskContributions(fixture);
  assert.equal(result.methodology, "exposure-weighted-risk-proxy-v1");
  assert.equal(result.total_contribution_pct.toFixed(4), "100.0000");
  assert.equal(result.holdings[0].contribution_pct.toFixed(4), "78.9474");
  assert.equal(result.categories.find((item) => item.category === "FIXED_INCOME").contribution_pct.toFixed(4), "19.7368");
  assert.equal(result.categories.find((item) => item.category === "CASH").contribution_pct.toFixed(4), "1.3158");
});

test("US-1202 unit: empty or invalid holdings are rejected rather than fabricated", () => {
  assert.throws(() => calculateRiskContributions([]), /NO_HOLDINGS/);
  assert.throws(() => calculateRiskContributions([{ ...fixture[0], portfolioWeight: 0 }]), /NO_RISK_EXPOSURE/);
});
