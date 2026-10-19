import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const uiSource = readFileSync(new URL("apps/web/index.html", root), "utf8");

test("TC-US-0501-ui: product shell exposes the complete placeholder navigation", () => {
  for (const label of ["Portfolio", "Performance", "Dividends", "Calendar", "Actions", "Money Flow", "Reports", "Goals", "Analytics", "Settings"]) {
    assert.match(uiSource, new RegExp(`data-nav="${label}"`));
  }
  assert.match(uiSource, /data-feature-state="backend-pending"/);
  assert.match(uiSource, /data-testid="feature-lock"/);
});

test("TC-US-0501-ui: dashboard keeps ledger/read-model boundary visible", () => {
  assert.match(uiSource, /canonical ledger/);
  assert.match(uiSource, /read model/);
  assert.match(uiSource, /synthetic/);
  assert.match(uiSource, /trace-id/);
});

test("TC-US-0501-ui: dashboard is a viewport cockpit without page-level vertical overflow", () => {
  assert.match(uiSource, /data-layout="viewport-cockpit"/);
  assert.match(uiSource, /content-shell/);
  assert.match(uiSource, /dashboard-grid/);
  assert.match(uiSource, /Performance:\[/);
  assert.match(uiSource, /route-panel/);
  assert.match(uiSource, /routePage/);
  assert.match(uiSource, /overflow:\s*hidden/);
  assert.match(uiSource, /overflow-y:\s*auto/);
});
