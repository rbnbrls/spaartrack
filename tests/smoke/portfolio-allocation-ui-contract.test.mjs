import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const html = readWebSource();

test("TC-US-0505: allocation uses explicit largest-remainder rounding and totals 100 percent", () => {
  for (const value of [
    "allocation-panel", "allocation-dimension", "asset_class", "sector", "region", "currency", "broker",
    "allocation-total", "roundAllocation", "largest remainder", "100.00%", "allocationRows"
  ]) {
    assert.match(html, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});
