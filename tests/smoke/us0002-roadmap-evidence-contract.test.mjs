import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const roadmap = readFileSync(new URL("roadmap.md", root), "utf8");
const testCases = readFileSync(new URL("test-cases.md", root), "utf8");
const us0002Row = roadmap
  .split("\n")
  .find((line) => line.startsWith("| US-0002 |"));

test("US-0002 roadmap status reports blocked, not verified evidence", () => {
  assert.ok(us0002Row, "US-0002 roadmap row exists");
  assert.match(us0002Row, /NOT VERIFIED/i);
  assert.match(us0002Row, /BLOCKED/i);
  assert.match(us0002Row, /owner decisions/i);
  assert.match(us0002Row, /executable behavior evidence/i);
  assert.match(us0002Row, /prose-only/i);
  assert.match(us0002Row, /TC-US-0002(?:-A)?/);
  assert.match(us0002Row, /TC-US-0002-B/);
  assert.match(us0002Row, /TC-US-0002-C/);
  assert.doesNotMatch(us0002Row, /Done locally|fail.to.pass|462\/462|healthy.stack/i);
});

test("US-0002 traceability retains the exact parent and child test IDs", () => {
  for (const testId of [
    "TC-US-0002",
    "TC-US-0002-A",
    "TC-US-0002-B",
    "TC-US-0002-C",
  ]) {
    assert.ok(testCases.includes(`| ${testId} |`), `${testId} remains catalogued`);
    assert.ok(us0002Row.includes(testId), `${testId} is linked from the roadmap`);
  }
});

test("US-0002 distinguishes a prose contract from behavioral validation", () => {
  assert.match(us0002Row, /prose-only/i);
  assert.match(us0002Row, /does not verify financial behavior/i);
  assert.match(us0002Row, /executable behavior evidence/i);
});
