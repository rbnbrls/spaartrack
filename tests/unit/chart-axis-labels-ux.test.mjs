import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readWebSource } from "../helpers/web-source.mjs";

const html = readWebSource();

test("TC-US-0503-UX: Portfolio performance chart labels both axes with unit and time scale", () => {
  assert.match(html, /addChartAxisLabels\([\s\S]*chartId:'portfolio-line-chart'/);
  assert.match(html, /xLabel:'Datum'/);
  assert.match(html, /yLabel:'Portfoliowaarde \(EUR\)'/);
});

test("TC-US-0701-UX: Dividend chart labels both axes with unit and time scale", () => {
  assert.match(html, /addChartAxisLabels\([\s\S]*chartId:'dividend-chart'/);
  assert.match(html, /xLabel:'Periode'/);
  assert.match(html, /yLabel:'Dividendinkomen \(EUR\)'/);
});
