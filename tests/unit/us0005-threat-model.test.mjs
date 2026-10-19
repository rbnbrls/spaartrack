import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const doc = fs.readFileSync(
  new URL("../../docs/security/threat-model.md", import.meta.url),
  "utf8"
);

test("US-0005: threat model dekt assets, boundaries, abuse cases en mitigaties", () => {
  for (const section of ["assets", "trust boundar", "abuse case", "mitigatie"]) {
    assert.match(doc, new RegExp(section, "i"), `sectie ontbreekt: ${section}`);
  }
  for (const domain of ["auth", "integration", "AI", "deploy"]) {
    assert.match(doc, new RegExp(domain, "i"), `domein ontbreekt: ${domain}`);
  }
  assert.match(doc, /TC-US-0005/i, "traceability naar TC-US-0005 ontbreekt");
});
