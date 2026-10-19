import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname;

// ISSUE-06: Wave 0 fixturepacks must exist as versioned files, not just prose.
const REQUIRED = ["ENV-001", "SEC-001", "LEDGER-001", "BANK-001", "TAX-001", "OPS-001"];

for (const id of REQUIRED) {
  test(`ISSUE-06: fixture pack ${id} exists as a versioned synthetic file`, () => {
    const path = join(ROOT, "fixtures", `${id}.json`);
    assert.ok(existsSync(path), `${id}.json must exist in fixtures/`);
    const pack = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(pack.fixture_id, id);
    assert.match(pack.version ?? "", /^\d+\.\d+\.\d+$/, `${id} must carry a semver version`);
    assert.ok((pack.description ?? "").length > 10, `${id} must describe its synthetic scenario`);
    const serialized = JSON.stringify(pack);
    for (const needle of ["password", "secret", "api_key", "apikey", "token", "iban", "credential"]) {
      assert.doesNotMatch(serialized.toLowerCase(), new RegExp(`"${needle}"\\s*:\\s*"[^"]{3,}"`), `${id} must not embed real ${needle} values`);
    }
  });
}
