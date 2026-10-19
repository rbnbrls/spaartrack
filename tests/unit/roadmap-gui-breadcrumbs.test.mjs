import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const roadmap = readFileSync(new URL("../../roadmap.md", import.meta.url), "utf8");
const parentStorySection = roadmap.slice(roadmap.indexOf("#### Slice 0 — productcontract en architectuur"), roadmap.indexOf("### User-story Definition of Ready"));
const parentRows = parentStorySection.split("\n").filter((line) => /^\| US-\d{4}(?: \|| —)/.test(line));

test("every parent user story has a GUI breadcrumb", () => {
  assert.equal(parentRows.length, 133);
  assert.match(parentStorySection, /\| GUI-breadcrumb \|/);
  for (const row of parentRows) {
    const columns = row.split("|").map((column) => column.trim());
    assert.equal(columns.length, 6, row);
    assert.match(columns[3], /^`[^`]+`$/, row);
  }
});
