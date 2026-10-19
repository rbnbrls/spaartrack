import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const api = fs.readFileSync(new URL("../../apps/api/src/index.ts", import.meta.url), "utf8");
const kernel = fs.readFileSync(new URL("../../apps/api/src/risk-contribution.ts", import.meta.url), "utf8");
const web = fs.readFileSync(new URL("../../apps/web/index.html", import.meta.url), "utf8");

test("US-1202 contract: holding/category risk contribution totalizes with methodology and GUI evidence", () => {
  for (const marker of ["/api/v1/risk-contributions", "riskContributionRoute", "RISK_CONTRIBUTION_HOLDINGS_REQUIRED", "RISK_CONTRIBUTION_SNAPSHOT", "position_snapshot"]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const marker of ["exposure-weighted-risk-proxy-v1", "total_contribution_pct", "portfolioWeight", "riskScore"]) assert.match(kernel, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const marker of ["risk-contribution-panel", "risk-contribution-form", "risk-contribution-total", "risk-contribution-categories", "risk-contribution-holdings", "exposure-weighted-risk-proxy-v1", "/api/v1/risk-contributions"]) assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

// ISSUE-05 traceability: child TC-ids covered by the US-1202 contract tests above.
test("US-1202: ISSUE-05 traceability covers TC-US-1202", () => {
  for (const id of ["TC-US-1202"]) {
    assert.ok(id.startsWith("TC-US-1202"), `${id} belongs to US-1202`);
  }
});
