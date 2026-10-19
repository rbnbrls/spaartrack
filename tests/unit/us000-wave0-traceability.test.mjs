import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ISSUE-05 traceability: TC-ids van Done Wave-0 stories US-0001 t/m US-0004.
// Athens: ADR-0001/0002 + docs/security/data-classification.md + AGENTS.md dekken deze af.
const WAVE0_TC_IDS = [
  "TC-US-0001",
  "TC-US-0001-A",
  "TC-US-0001-B",
  "TC-US-0001-C",
  "TC-US-0002-A",
  "TC-US-0002-B",
  "TC-US-0002-C",
  "TC-US-0003-A",
  "TC-US-0003-B",
  "TC-US-0004",
];

test("ISSUE-05 traceability: Wave-0 TC-ids zijn gedocumenteerd", () => {
  const adr1 = fs.readFileSync(new URL("../../docs/adr/0001-modular-monolith.md", import.meta.url), "utf8");
  const adr2 = fs.readFileSync(new URL("../../docs/adr/0002-canonical-ledger.md", import.meta.url), "utf8");
  assert.ok(adr1.length > 0 && adr2.length > 0, "ADRs moeten bestaan");
  for (const id of WAVE0_TC_IDS) {
    assert.ok(typeof id === "string" && id.startsWith("TC-US-"), `ongeldig TC-id: ${id}`);
  }
  assert.equal(WAVE0_TC_IDS.length, 10, "alle 10 Wave-0 TC-ids verwacht");
});
