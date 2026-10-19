import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname;
// Parent stories that are still open locally: Wave 0 contract + autonomous operations.
// Their TC-ids are documented as pending, not required to be green.
const OPEN_PARENTS = new Set(["US-0001", "US-0002", "US-0003", "US-0004", "US-0005", "US-1705", "US-1706", "US-1707", "US-1708", "US-1709"]);

function collectTcIds(source) {
  const ids = new Set();
  for (const m of source.matchAll(/TC-US-\d+(?:-[A-Z0-9]+)*/g)) ids.add(m[0]);
  return ids;
}

function parentOf(tc) {
  return `US-${tc.slice("TC-US-".length).split("-")[0]}`;
}

test("ISSUE-05: every TC-US-* id of a Done story is referenced in a test file (open stories pending)", () => {
  const cases = readFileSync(join(ROOT, "test-cases.md"), "utf8");
  const expected = collectTcIds(cases);
  assert.ok(expected.size > 200, `expected 200+ TC ids, got ${expected.size}`);
  let corpus = "";
  for (const dir of ["tests/unit", "tests/smoke"]) {
    for (const f of readdirSync(join(ROOT, dir))) {
      if (f.endsWith(".test.mjs")) corpus += readFileSync(join(ROOT, dir, f), "utf8") + "\n";
    }
  }
  const missingDone = [...expected].filter((id) => !OPEN_PARENTS.has(parentOf(id)) && !corpus.includes(id)).sort();
  const missingOpen = [...expected].filter((id) => OPEN_PARENTS.has(parentOf(id)) && !corpus.includes(id)).sort();
  assert.deepEqual(missingDone, [], `missing Done-story TC ids (${missingDone.length}): ${missingDone.slice(0, 20).join(", ")}${missingDone.length > 20 ? " …" : ""}`);
  assert.ok(missingOpen.length > 0, "open-story TC-ids should be documented as pending");
});
