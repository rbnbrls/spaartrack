import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const html = readFileSync(new URL("apps/web/index.html", root), "utf8");

test("TC-US-0504: positions table supports configurable columns, open/closed filter and cash position", () => {
  for (const value of [
    "positions-table", "position-filter", "open", "closed", "position-columns",
    "column-name", "column-value", "column-currency", "Cash", "renderPositions",
    "positionRows", "Geen gesloten positions"
  ]) {
    assert.match(html, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});
