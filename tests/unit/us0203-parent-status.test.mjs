import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const roadmap = readFileSync(new URL("roadmap.md", root), "utf8");

test("TC-US-0203: parent status reflects atomic children A/B coverage", () => {
  const row = roadmap.split("\n").find((l) => l.startsWith("| US-0203 |"));
  assert.ok(row, "US-0203 row missing");
  assert.match(row, /US-0203-A/, "parent must reference child US-0203-A");
  assert.match(row, /US-0203-B/, "parent must reference child US-0203-B");
  assert.match(row, /Done lokaal/, "parent must be marked Done via children");
});
