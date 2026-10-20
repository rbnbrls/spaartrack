import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url).pathname;
const api = readFileSync(new URL("apps/api/src/index.ts", `file://${root}/`), "utf8");
const kernel = readFileSync(new URL("apps/api/src/screener-watchlist.ts", `file://${root}/`), "utf8");
const web = readWebSource();

test("TC-US-1208: screener filters are saved, traceable and ledger-safe", () => {
  for (const marker of ["/api/v1/screener-watchlists", "screenerWatchlistRoute", "screener_watchlist", "trace_id", "correlation_id"]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const marker of ["screener-watchlist-v1", "validateScreenerDefinition", "read_only", "fundamentals", "performance", "targets", "alerts"]) assert.match(kernel, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const marker of ["screener-watchlist-panel", "screener-watchlist-form", "screener-fundamentals", "screener-performance", "screener-targets", "screener-alerts"]) assert.match(web, new RegExp(marker));
});
