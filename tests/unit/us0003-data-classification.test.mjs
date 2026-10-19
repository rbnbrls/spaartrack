import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const doc = fs.readFileSync(
  new URL("../../docs/security/data-classification.md", import.meta.url),
  "utf8"
);

const DOMAINS = ["user", "account", "transaction", "raw payload", "log"];
const DIMS = ["classificatie", "retention", "masking", "toegang"];

test("US-0003: dataclassificatie dekt alle domeinen en dimensies", () => {
  for (const d of DOMAINS) {
    assert.match(doc, new RegExp(d, "i"), `domein ontbreekt: ${d}`);
  }
  for (const dim of DIMS) {
    assert.match(doc, new RegExp(dim, "i"), `dimensie ontbreekt: ${dim}`);
  }
  assert.match(doc, /TC-US-0003/i, "traceability naar TC-US-0003 ontbreekt");
});
