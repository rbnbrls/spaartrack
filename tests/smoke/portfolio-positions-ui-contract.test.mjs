import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const html = readWebSource();

test("TC-US-0504: positions table supports configurable columns, open/closed filter and cash position", () => {
  for (const value of [
    "positions-table", "position-filter", "open", "closed", "position-columns",
    "column-name", "column-value", "column-currency", "Cash", "renderPositions",
    "positionRows", "Geen gesloten positions"
  ]) {
    assert.match(html, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});
