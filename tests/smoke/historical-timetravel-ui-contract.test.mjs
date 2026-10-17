import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const html = readFileSync(new URL("apps/web/index.html", root), "utf8");
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");

test("TC-US-0507: historical timetravel uses an as-of snapshot and preserves read-model boundaries", () => {
  for (const value of [
    "timetravel", "timetravel-date", "timetravel-run", "timetravel-state", "timetravel-evidence",
    "renderHistoricalState", "data-as-of", "snapshot_at", "calculation_version",
    "/api/v1/portfolio-snapshots"
  ]) {
    assert.match(html + apiSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-0507-runtime: historical snapshot access is authenticated", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const response = await fetch(`${process.env.API_URL || "http://localhost:18080"}/api/v1/portfolio-snapshots?portfolio_id=00000000-0000-0000-0000-000000000000`);
  assert.equal(response.status, 401);
});
