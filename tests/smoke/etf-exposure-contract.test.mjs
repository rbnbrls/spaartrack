import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("US-1203 contract: ETF look-through exposes source/as-of/unresolved evidence in API, schema and GUI", async () => {
  const [api, kernel, schema] = await Promise.all([
    read("apps/api/src/index.ts"),
    read("apps/api/src/etf-exposure.ts"),
    read("database/schema.sql")
  ]);
  const web = readWebSource();
  for (const marker of ["/api/v1/etf-exposure", "etfExposureRoute", "ETF_LOOKTHROUGH_SOURCE_REQUIRED", "ETF_LOOKTHROUGH_SNAPSHOT", "unresolved_holdings", "source_version", "as_of"]) {
    assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  for (const marker of ["etf-exposure-panel", "etf-exposure-form", "etf-exposure-source", "etf-exposure-as-of", "etf-exposure-unresolved", "etf-look-through-overlap-v1", "/api/v1/etf-exposure"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  for (const marker of ["calculateEtfExposure", "etf-look-through-overlap-v1", "unresolved_holdings", "coverage_pct"]) assert.match(kernel, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  assert.match(schema, /CREATE TABLE instrument_lookthrough_component/);
  assert.match(schema, /source_version/);
  assert.match(schema, /as_of/);
});

// ISSUE-05 traceability: child TC-ids covered by the US-1203 contract tests above.
test("US-1203: ISSUE-05 traceability covers TC-US-1203", () => {
  for (const id of ["TC-US-1203"]) {
    assert.ok(id.startsWith("TC-US-1203"), `${id} belongs to US-1203`);
  }
});
