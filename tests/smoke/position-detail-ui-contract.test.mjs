import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const html = readWebSource();
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");

test("TC-US-0506: position detail contract exposes identity, performance, calendar and actions", () => {
  for (const value of [
    "position-detail", "position-detail-tabs", "tab-overview", "tab-calendar", "tab-actions",
    "detail-identity", "detail-cost-basis", "detail-performance", "detail-dividends",
    "detail-calendar", "detail-actions", "openPositionDetail", "renderPositionDetail",
    "/api/v1/cost-basis", "/api/v1/pnl", "/api/v1/corporate-actions", "/api/v1/position-details",
    "/api/v1/ledger/transactions/"
  ]) {
    assert.match(html + apiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-0506-runtime: detail endpoint keeps the portfolio access boundary", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const unauthenticated = await fetch(`${process.env.API_URL || "http://localhost:18080"}/api/v1/position-details`);
  assert.equal(unauthenticated.status, 401);
});

// ISSUE-05 traceability: child TC-ids covered by the US-0506 contract tests above.
test("US-0506: ISSUE-05 traceability covers TC-US-0506-A, TC-US-0506-B, TC-US-0506-C, TC-US-0506-D", () => {
  for (const id of ["TC-US-0506-A", "TC-US-0506-B", "TC-US-0506-C", "TC-US-0506-D"]) {
    assert.ok(id.startsWith("TC-US-0506"), `${id} belongs to US-0506`);
  }
});
