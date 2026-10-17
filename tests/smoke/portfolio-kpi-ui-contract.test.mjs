import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const html = readFileSync(new URL("apps/web/index.html", root), "utf8");

test("TC-US-0503: portfolio KPIs are rendered from the calculation read model", () => {
  for (const value of [
    "portfolio-kpis", "portfolio-value", "invested-capital", "free-cash", "snapshot",
    "Portfolio value", "Invested capital", "Free cash", "/api/v1/portfolio-snapshots",
    "state.snapshot", "renderKpis"
  ]) {
    assert.match(html, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});
