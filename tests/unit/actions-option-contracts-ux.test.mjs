import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../../apps/web/index.html", import.meta.url), "utf8");

test("TC-US-1404-UX: Actions option contracts page has a clear, accessible overview", () => {
  const panel = html.match(/<section[^>]*id="option-contract-panel"[\s\S]*?<\/section>/)?.[0];
  assert.ok(panel, "option contracts panel must exist");
  assert.match(html, /setAttribute\('aria-labelledby','option-contract-page-title'\)/);
  assert.match(html, /id="option-contract-page-title"[^>]*>Actions \/ Option contracts &amp; Greeks<\/h1>/);
  for (const marker of ["option-contract-value", "option-contract-open", "option-contract-expiry", "option-contract-risk"]) {
    assert.match(html, new RegExp(`id="${marker}"`), marker);
  }
  assert.match(html, /id="option-contract-filter"/);
  assert.match(html, /id="option-contract-reset"/);
});

test("TC-US-1404-UX: Actions option contracts page exposes table data, states and traceability", () => {
  assert.match(html, /id="option-contract-table"[\s\S]*scope="col"/);
  assert.match(html, /id="option-contract-empty"/);
  assert.match(html, /id="option-contract-loading"/);
  assert.match(html, /id="option-contract-error"/);
  assert.match(html, /id="option-contract-view-status"[^>]*role="status"/);
  assert.match(html, /id="option-contract-trace-id"/);
  assert.match(html, /id="option-contract-correlation-id"/);
  assert.match(html, /id="option-contract-filter"[\s\S]*addEventListener/);
  assert.match(html, /id="option-contract-reset"[\s\S]*addEventListener/);
});

test("TC-US-1404-UX: Interactive Actions controls have usable touch targets and non-colour status", () => {
  const panel = html.match(/<section[^>]*id="option-contract-panel"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.match(panel, /class="btn[^\"]*"[^>]*id="prepare-option-contract"/);
  assert.match(panel, /class="btn[^\"]*"[^>]*id="option-greeks-calculate"/);
  assert.match(html, /\.route-panel \.btn[^{]*\{[^}]*min-height:44px/);
  assert.match(html, /\.route-panel \.select[^{]*\{[^}]*min-height:44px/);
  assert.match(html, /OPEN · actief|OPEN · active/);
});
