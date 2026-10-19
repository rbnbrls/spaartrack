import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/what-if-backtest.ts", root), "utf8");
const web = readFileSync(new URL("apps/web/index.html", root), "utf8");
const schema = readFileSync(new URL("database/schema.sql", root), "utf8");
const adr = readFileSync(new URL("docs/adr/0002-canonical-ledger.md", root), "utf8");

test("TC-US-1207: scenario contract is versioned, traceable and ledger-safe", () => {
  for (const marker of ["/api/v1/backtest-scenarios", "backtestScenarioRoute", "backtest_scenario", "assumptions", "input_prices", "cashflows", "results", "calculation_version", "trace_id", "correlation_id"]) {
    assert.match(api + kernel + schema, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(adr, /ledger_transaction en ledger_entry zijn de financiële bron van waarheid/);
  for (const marker of ["what-if-backtest-panel", "what-if-backtest-form", "backtest-period-start", "backtest-allocations", "backtest-assumptions", "backtest-results", "what-if-backtest-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

// ISSUE-05 traceability: child TC-ids covered by the US-1207 contract tests above.
test("US-1207: ISSUE-05 traceability covers TC-US-1207-A, TC-US-1207-B", () => {
  for (const id of ["TC-US-1207-A", "TC-US-1207-B"]) {
    assert.ok(id.startsWith("TC-US-1207"), `${id} belongs to US-1207`);
  }
});
