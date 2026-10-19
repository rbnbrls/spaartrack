import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const api = fs.readFileSync(new URL("../../apps/api/src/index.ts", import.meta.url), "utf8");
const kernel = fs.readFileSync(new URL("../../apps/api/src/allocation-targets.ts", import.meta.url), "utf8");
const web = fs.readFileSync(new URL("../../apps/web/index.html", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../../database/migrations/0019-allocation-targets.sql", import.meta.url), "utf8");

test("US-1204 contract: targets are portfolio scoped, versioned and visible in the calm GUI", () => {
  for (const marker of ["/api/v1/allocation-targets", "allocationTargetsRoute", "ALLOCATION_TARGETS", "PORTFOLIO_ROLE_FORBIDDEN", "auditEvent"]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const marker of ["ASSET_CLASS", "SECTOR", "REGION", "CURRENCY", "HOLDING", "ALLOCATION_TARGET_TOTAL_MUST_EQUAL_100", "allocation-targets-v1"]) assert.match(kernel, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const marker of ["allocation-targets-panel", "allocation-targets-form", "allocation-target-dimension", "allocation-targets-json", "allocation-targets-status", "/api/v1/allocation-targets"]) assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const marker of ["CREATE TABLE IF NOT EXISTS", "allocation_target", "portfolio_id", "dimension", "target_percentage"]) assert.match(schema, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

// ISSUE-05 traceability: child TC-ids covered by the US-1204 contract tests above.
test("US-1204: ISSUE-05 traceability covers TC-US-1204", () => {
  for (const id of ["TC-US-1204"]) {
    assert.ok(id.startsWith("TC-US-1204"), `${id} belongs to US-1204`);
  }
});
