import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../../apps/web/index.html", import.meta.url), "utf8");

test("TC-US-1105-UX: Goals funding page has a clear hierarchy and truthful navigation state", () => {
  assert.match(html, /data-nav="Goals" aria-label="Goals"(?![^>]*soon)/, "Goals is an available route, not a soon placeholder");
  assert.match(html, /id="goal-funding-panel"[^>]*aria-labelledby="goal-funding-page-title"/);
  assert.match(html, /<h1 id="goal-funding-page-title">Doelen<\/h1>/);
  for (const marker of ["goal-summary-target", "goal-summary-date", "goal-summary-contribution", "goal-summary-status"]) {
    assert.match(html, new RegExp(`id="${marker}"`), `${marker} keeps the goal overview scannable`);
  }
});

test("TC-US-1105-UX: Funding form exposes reversible states, inline errors and trace evidence", () => {
  assert.match(html, /id="save-goal-funding"[^>]*disabled/, "save is unavailable until a fixture is prepared");
  assert.match(html, /id="funding-state"[^>]*role="status"/);
  assert.match(html, /id="funding-error"[^>]*role="alert"[^>]*hidden/);
  assert.match(html, /id="funding-a"[^>]*aria-describedby="funding-error"/);
  assert.match(html, /id="funding-b"[^>]*aria-describedby="funding-error"/);
  assert.match(html, /id="funding-trace-id"/);
  assert.match(html, /id="funding-correlation-id"/);
  assert.match(html, /fundingStatus\.textContent='validation error'/);
  assert.match(html, /fundingError\.hidden=false/);
});

test("TC-US-1105-UX: Funding controls retain keyboard and touch-target affordances", () => {
  assert.match(html, /\.route-panel \.btn,\.route-panel \.select,\.route-panel \.search\{min-height:44px\}/);
  assert.match(html, /\.route-panel .*:focus-visible/);
  assert.match(html, /inputmode="decimal"/);
});
