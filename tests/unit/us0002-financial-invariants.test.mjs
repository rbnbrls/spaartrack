import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const adr = fs.readFileSync(
  new URL("../../docs/adr/0002-canonical-ledger.md", import.meta.url),
  "utf8"
);

const INVARIANTS = ["cash", "quantity", "cost basis", "transfer", "FX", "idempotency"];

test("US-0002: financiele invariants staan als testbare regels in ADR-0002", () => {
  for (const inv of INVARIANTS) {
    assert.match(adr, new RegExp(inv, "i"), `invariant ontbreekt: ${inv}`);
  }
  assert.match(adr, /TC-US-0002/i, "traceability naar TC-US-0002 ontbreekt");
});
