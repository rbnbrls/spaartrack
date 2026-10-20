import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readWebSource } from "../helpers/web-source.mjs";

const uiSource = readWebSource();

test("TC-US-0503-ui: portfolio visuals are driven by the portfolio snapshot read model", () => {
  for (const marker of [
    "portfolio-visuals-v1",
    "/api/v1/portfolio-snapshots",
    "data-visual-source",
    "portfolio-line-chart",
    "allocation-donut",
    "renderPortfolioVisuals",
    "source: portfolio_snapshot",
  ]) {
    assert.match(uiSource, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")), marker);
  }
});
