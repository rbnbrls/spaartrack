import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname;

// US-0002 is intentionally NOT VERIFIED/BLOCKED; the remaining Slice-0
// governance stories are locally done. Keep this test source-bound so it does
// not turn the financial-owner gate into a false green.
test("US-WAVE0-STATUS: roadmap reports the current Slice-0 gate", () => {
  const roadmap = readFileSync(join(ROOT, "roadmap.md"), "utf8");
  const slice0Done = ["US-0001", "US-0003", "US-0004", "US-0005"].every(
    (id) => new RegExp(`\\| ${id} \\|.*Done lokaal`).test(roadmap),
  );
  assert.ok(slice0Done, "Slice-0 governance stories must be Done lokaal");
  const us0002 = roadmap.split("\n").find((line) => line.startsWith("| US-0002 |"));
  assert.ok(us0002, "US-0002 row must exist");
  assert.match(us0002, /NOT VERIFIED/);
  assert.match(us0002, /BLOCKED/);
  const start = roadmap.indexOf("Wave 0 formalisatie");
  const rest = roadmap.slice(start);
  const nextHeader = rest.indexOf("####", 10);
  const block = nextHeader > 0 ? rest.slice(0, nextHeader) : rest;
  assert.ok(
    !/resterend zijn/.test(block),
    "formalisatieblok mag geen achterhaalde 'resterend'-claim meer bevatten",
  );
  assert.ok(/133\/133.*Done/.test(block), "formalisatieblok moet 133/133 Done vermelden");
});
