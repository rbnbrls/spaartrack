import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../..", import.meta.url);
const html = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");

test("TC-US-1401-UX: Analytics bond profiles has a scoped page hierarchy and overview", () => {
  assert.match(html, /data-route="Analytics"[^>]*aria-labelledby="analytics-bond-page-title"/);
  assert.match(html, /id="analytics-bond-page-title"[^>]*>Analytics \/ Bondprofielen &amp; cashflows<\/h1>/);
  for (const marker of ["bond-overview-count", "bond-overview-coupon", "bond-overview-principal", "bond-overview-status"]) {
    assert.match(html, new RegExp(`id="${marker}"`), marker);
  }
});

test("TC-US-1401-UX: Bond cashflows are scannable, accessible and state-complete", () => {
  assert.match(html, /id="bond-cashflow-table"[\s\S]*scope="col"/);
  for (const marker of ["bond-cashflow-empty", "bond-cashflow-loading", "bond-cashflow-error", "bond-cashflow-view-status", "bond-profile-trace-id", "bond-profile-correlation-id"]) {
    assert.match(html, new RegExp(`id="${marker}"`), marker);
  }
  assert.match(html, /id="bond-profile-reset"[\s\S]*addEventListener/);
  assert.match(html, /\.route-panel \.btn[^}]*min-height:44px/);
  assert.match(html, /overviewState\.setAttribute\('role', 'status'\)/);
  assert.match(html, /overviewState\.setAttribute\('aria-live', 'polite'\)/);
});

test("TC-US-1401-UX: Bond overview keeps result state and run evidence consistent", () => {
  assert.match(html, /overviewState\.textContent = generated \? 'calculated · read-only' : 'synthetic fixture · read-only'/);
  assert.match(html, /__bondRunEvidence\.trace/);
  assert.match(html, /__bondRunEvidence\.correlation/);
  assert.match(html, /__bondRunEvidence\.error/);
  assert.match(html, /bond-profile-reset.*overviewState\.textContent = 'synthetic fixture · read-only'/);
});

test("TC-US-1402-UX / TC-US-1403-UX: Bond calculation failures preserve traceability in API logs", () => {
  assert.match(api, /bond_profile_failed[\s\S]*trace_id[\s\S]*correlation_id/);
  assert.match(api, /bond_cashflow_failed[\s\S]*trace_id[\s\S]*correlation_id/);
  assert.match(api, /bond_pricing_failed[\s\S]*trace_id[\s\S]*correlation_id/);
  assert.match(api, /bond_curve_scenario_failed[\s\S]*trace_id[\s\S]*correlation_id/);
});
