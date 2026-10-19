import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const html = readFileSync(new URL("apps/web/index.html", root), "utf8");

test("GUI shell exposes every acceptance navigation surface", () => {
  for (const label of ["Portfolio", "Performance", "Dividends", "Calendar", "Actions", "Money Flow", "Reports", "Goals", "Analytics", "Settings"]) {
    assert.match(html, new RegExp(`data-nav=\"${label}\"`));
  }
});

test("backend-pending features are represented as disabled placeholders", () => {
  assert.match(html, /data-feature-state=\"backend-pending\"/);
  assert.match(html, /data-testid=\"feature-lock\"/);
  assert.match(html, /canonical ledger/);
  assert.match(html, /read-model snapshots/);
  assert.match(html, /trace\/correlation-ID/);
  assert.match(html, /<button[^>]*id="add-action"[^>]*disabled[^>]*>[\s\S]*?Add action/);
});

test("local GUI uses synthetic evidence and no provider credentials", () => {
  assert.match(html, /synthetic/);
  assert.match(html, /trace-id/);
  assert.match(html, /correlation-id/);
  assert.doesNotMatch(html, /(api[_-]?key|client[_-]?secret|password\s*=)/i);
});

test("Module switcher stays compact and uses the active page context", () => {
  assert.match(html, /module-nav-select/);
  assert.match(html, /module-nav-label\">\$\{active\} modules/);
  assert.match(html, /aria-label=\"\$\{active\} modules\"/);
  assert.match(html, /id=\"page-subtitle\"/);
  assert.match(html, /dataset\.route='Settings'/);
  assert.doesNotMatch(html, /visual placeholder geselecteerd/);
});

test("initial portfolio cockpit has a compact no-scroll viewport contract and code-built visuals", () => {
  assert.match(html, /@media\(min-width:761px\) and \(max-height:800px\)/);
  assert.match(html, /body\[data-route="Portfolio"\] \.content > \.grid-main/);
  assert.match(html, /<svg[^>]+id="portfolio-line-chart"/);
  assert.match(html, /class="donut"[^>]+id="allocation-donut"/);
  assert.doesNotMatch(html, /<img\b/i);
});

test("bond pricing fixture keeps the session token in its pricing context", () => {
  assert.match(html, /bondPricingContext=\{token:session\.token,instrumentId:instrument\.id\}/);
  assert.doesNotMatch(html, /bondPricingContext=\{token,instrumentId:instrument\.id\}/);
});

test("bond profile fixture keeps the session token in its profile context", () => {
  assert.match(html, /bondProfileContext=\{token:session\.token,portfolioId:portfolio\.id,instrumentId:instrument\.id\}/);
  assert.doesNotMatch(html, /bondProfileContext=\{token,portfolioId:portfolio\.id,instrumentId:instrument\.id\}/);
});

test("option lifecycle panel exposes the human-acceptance journey without session token bugs", () => {
  assert.match(html, /optionLifecycleContext=\{token:session\.token,portfolioId:portfolio\.id/);
  assert.doesNotMatch(html, /optionLifecycleContext=\{token,/);
});
