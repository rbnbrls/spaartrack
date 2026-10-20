import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const html = readWebSource();

test("TC-US-0503: portfolio KPIs are rendered from the calculation read model", () => {
  for (const value of [
    "portfolio-kpis", "portfolio-value", "invested-capital", "free-cash", "snapshot",
    "Portfolio value", "Invested capital", "Free cash", "/api/v1/portfolio-snapshots",
    "state.snapshot", "renderKpis"
  ]) {
    assert.match(html, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});
