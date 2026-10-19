import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../../apps/web/index.html", import.meta.url), "utf8");

test("TC-US-0701/0702/0703/0705-UX: Dividends has a complete overview contract", () => {
  assert.match(html, /id="dividend-overview-panel"[^>]*data-route="Dividends"/);
  assert.match(html, /<h1[^>]*>Dividends \/ Overview<\/h1>/);
  for (const id of ["dividend-received", "dividend-expected", "dividend-ttm", "dividend-padi"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const label of ["Maand", "Kwartaal", "Jaar", "Aangepaste periode"]) {
    assert.match(html, new RegExp(`>${label}<`));
  }
  assert.match(html, /id="dividend-chart"[^>]*aria-describedby="dividend-chart-data"/);
  assert.match(html, /id="dividend-chart-data"/);
  assert.match(html, /id="dividend-events-table"/);
  assert.match(html, /id="dividend-empty-state"/);
});

test("TC-US-0702/0706-UX: Dividend overview exposes traceability and resilient interaction wiring", () => {
  assert.match(html, /id="dividend-filter-status"[^>]*role="status"/);
  assert.match(html, /type="button"[^>]*id="dividend-reset"/);
  assert.match(html, /id="dividend-overview-panel"[\s\S]*trace-id[\s\S]*correlation-id/);
  assert.match(html, /function renderDividendOverview/);
  assert.match(html, /dividend-reset[\s\S]*addEventListener/);
  assert.match(html, /period-button[\s\S]*addEventListener/);
});
