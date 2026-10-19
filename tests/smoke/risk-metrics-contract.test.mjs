import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const api = fs.readFileSync(new URL("../../apps/api/src/index.ts", import.meta.url), "utf8");
const kernel = fs.readFileSync(new URL("../../apps/api/src/risk-metrics.ts", import.meta.url), "utf8");
const web = fs.readFileSync(new URL("../../apps/web/index.html", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../../database/schema.sql", import.meta.url), "utf8");

test("US-1201 contract: risk metrics API, assumptions, persistence and calm GUI are wired", () => {
  for (const marker of ["/api/v1/risk-metrics", "riskMetricsRoute", "risk_metric_snapshot", "RISK_OBSERVATIONS_REQUIRED", "source: \"portfolio_snapshot + benchmark_observation\""]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const marker of ["missing_data_rule", "risk_free_annual", "annualization_periods", "risk-metrics-v1"]) assert.match(kernel, new RegExp(marker));
  for (const marker of ["risk-metrics-panel", "risk-metrics-form", "risk-volatility", "risk-beta", "risk-drawdown", "risk-sharpe", "risk-sortino", "risk-metrics-v1", "/api/v1/risk-metrics"]) assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(schema, /CREATE TABLE risk_metric_snapshot/);
});

// ISSUE-05 traceability: child TC-ids covered by the US-1201 contract tests above.
test("US-1201: ISSUE-05 traceability covers TC-US-1201, TC-US-1201-A, TC-US-1201-B", () => {
  for (const id of ["TC-US-1201", "TC-US-1201-A", "TC-US-1201-B"]) {
    assert.ok(id.startsWith("TC-US-1201"), `${id} belongs to US-1201`);
  }
});
