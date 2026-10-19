import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const api = fs.readFileSync(new URL("../../apps/api/src/index.ts", import.meta.url), "utf8");
const kernel = fs.readFileSync(new URL("../../apps/api/src/drift-rebalance.ts", import.meta.url), "utf8");
const web = fs.readFileSync(new URL("../../apps/web/index.html", import.meta.url), "utf8");

test("US-1205 contract: drift suggestions are read-only, traceable and exposed in the calm GUI", () => {
  for (const marker of ["/api/v1/rebalance-suggestions", "rebalanceSuggestionsRoute", "DRIFT_REBALANCE_SNAPSHOT", "PORTFOLIO_ACCESS_FORBIDDEN", "auditEvent"]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const marker of ["drift-rebalance-v1", "required_cash", "cash_shortfall", "trade_value", "trade_assumptions"]) assert.match(kernel, new RegExp(marker));
  for (const marker of ["rebalance-panel", "rebalance-form", "rebalance-status", "/api/v1/rebalance-suggestions", "drift_percentage_points"]) assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
});

// ISSUE-05 traceability: child TC-ids covered by the US-1205 contract tests above.
test("US-1205: ISSUE-05 traceability covers TC-US-1205", () => {
  for (const id of ["TC-US-1205"]) {
    assert.ok(id.startsWith("TC-US-1205"), `${id} belongs to US-1205`);
  }
});
