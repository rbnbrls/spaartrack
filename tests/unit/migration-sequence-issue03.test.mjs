import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";

// ISSUE-03: migratievolgnummers moeten uniek zijn voor een deterministische runner-volgorde.
test("ISSUE-03: migration sequence numbers are unique", () => {
  const files = readdirSync(new URL("../../database/migrations/", import.meta.url));
  const seqs = files.map((f) => f.split("-")[0]);
  const dupes = seqs.filter((s, i) => seqs.indexOf(s) !== i);
  assert.deepEqual(dupes, [], `duplicate migration sequence: ${dupes.join(",")}`);
});
