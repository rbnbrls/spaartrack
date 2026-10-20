import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const html = readWebSource();

test("TC-US-0503-UX: Portfolio overview keeps navigation and icon actions accessible", () => {
  for (const label of ["Portfolio", "Performance", "Dividends", "Calendar", "Actions", "Money Flow", "Reports", "Goals", "Analytics", "Community", "Settings"]) {
    assert.match(html, new RegExp(`data-nav=\"${label}\"[^>]*aria-label=\"${label}\"`), `${label} needs an accessible name`);
  }
  assert.match(html, /id="profile-button"[^>]*aria-label="Profiel"/);
  assert.match(html, /profile-button.*addEventListener/si, "profile action must be wired");
});

test("TC-US-0503-UX: Portfolio overview exposes filters and a chart data alternative", () => {
  assert.match(html, /id="portfolio-filters"/);
  for (const label of ["Sector", "Land", "Valuta", "Beurs"]) {
    assert.match(html, new RegExp(`aria-label=\"${label}\"`), `${label} filter is required`);
  }
  assert.match(html, /id="reset-portfolio-filters"/);
  assert.match(html, /id="portfolio-chart-data"/);
  assert.match(html, /aria-describedby="portfolio-chart-data"/);
  assert.match(html, /function applyPortfolioFilters/);
});

test("TC-US-0504: Portfolio positions remain visible on the overview route", () => {
  assert.doesNotMatch(html, /body\[data-route="Portfolio"\][^}]*\.table-card\{display:none}/);
  assert.match(html, /id="positions-table"/);
});
