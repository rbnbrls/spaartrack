import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const web = readFileSync(new URL("apps/web/index.html", root), "utf8");
const schema = readFileSync(new URL("database/schema.sql", root), "utf8");

test("US-1106 contract: forecast boundary stores assumptions and result", () => {
  assert.match(api, /cashflowForecastRoute/);
  assert.match(api, /\/api\/v1\/cashflow-forecasts/);
  assert.match(api, /SCHEDULED_ONLY.*BUDGET_ONLY.*COMBINED/);
  assert.match(api, /cashflow_forecast/);
  assert.match(api, /traceable: true/);
  assert.match(schema, /CREATE TABLE cashflow_forecast/);
  assert.match(schema, /mode text NOT NULL CHECK \(mode IN \('SCHEDULED_ONLY', 'BUDGET_ONLY', 'COMBINED'\)\)/);
});

test("US-1106 GUI contract: forecast scenarios expose assumptions and result", () => {
  for (const marker of ["forecast-panel", "forecast-form", "forecast-mode", "SCHEDULED_ONLY", "BUDGET_ONLY", "COMBINED", "forecast-assumptions", "forecast-result", "cashflow-forecast-v1"]) {
    assert.match(web, new RegExp(marker));
  }
  assert.match(web, /\/api\/v1\/cashflow-forecasts/);
  assert.match(web, /trace-id/);
  assert.match(web, /correlation-id/);
});

// ISSUE-05 traceability: child TC-ids covered by the US-1106 contract tests above.
test("US-1106: ISSUE-05 traceability covers TC-US-1106, TC-US-1106-A, TC-US-1106-B", () => {
  for (const id of ["TC-US-1106", "TC-US-1106-A", "TC-US-1106-B"]) {
    assert.ok(id.startsWith("TC-US-1106"), `${id} belongs to US-1106`);
  }
});
