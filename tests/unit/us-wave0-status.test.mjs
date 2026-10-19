import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname;

// Eerste open issue: roadmaptekst claimt nog "resterend US-0001 t/m US-0005"
// terwijl Slice-0-tabel alle vijf als Done lokaal markeert.
test("US-WAVE0-STATUS: roadmap claimt geen open Wave-0 stories meer", () => {
  const roadmap = readFileSync(join(ROOT, "roadmap.md"), "utf8");
  const slice0Done = ["US-0001", "US-0002", "US-0003", "US-0004", "US-0005"].every(
    (id) => new RegExp(`\\| ${id} \\|.*Done lokaal`).test(roadmap),
  );
  assert.ok(slice0Done, "Slice-0 tabel moet US-0001..US-0005 als Done lokaal tonen");
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
