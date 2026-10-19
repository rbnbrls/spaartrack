import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../../database/schema.sql", import.meta.url), "utf8");

const tables = [
  "sync_result_item",
  "allocation_target",
  "push_consent",
  "model_session",
  "addon_secret_ref",
  "addon_event_hook",
  "addon_asset",
  "addon_sandbox_run",
];

for (const table of tables) {
  test(`TC-US-ISSUE-02: schema.sql defines ${table}`, () => {
    assert.match(schema, new RegExp(`CREATE TABLE (IF NOT EXISTS )?${table} \\(`, "m"), `${table} must exist in schema.sql`);
  });
}
