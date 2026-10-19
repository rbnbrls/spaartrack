import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/fiscal-year-report.ts", root), "utf8");
const web = readFileSync(new URL("apps/web/index.html", root), "utf8");

test("TC-US-1304: fiscal-year report has jurisdiction and source boundaries", () => {
  for (const marker of ["/api/v1/fiscal-year-reports", "fiscalYearReportRoute", "portfolio_member", "trace_id", "correlation_id", "jurisdiction"]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const marker of ["buildFiscalYearReport", "fiscal-year-report-v1", "fiscal_year", "period", "taxable_result", "canonical-ledger-and-income-events"]) assert.match(kernel, new RegExp(marker));
  for (const marker of ["fiscal-year-report-panel", "fiscal-year-report-form", "fiscal-year-report-jurisdiction", "fiscal-year-report-period"]) assert.match(web, new RegExp(marker));
});

test("TC-US-1304-runtime: fiscal-year route is authenticated", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const response = await fetch(`${process.env.API_URL || "http://localhost:18080"}/api/v1/fiscal-year-reports?portfolio_id=00000000-0000-0000-0000-000000000000&fiscal_year=2026&jurisdiction=NL`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});
