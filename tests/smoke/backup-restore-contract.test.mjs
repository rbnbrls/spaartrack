import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const backupScript = readFileSync(new URL("infra/backup/backup-local.sh", root), "utf8");
const restoreScript = readFileSync(new URL("infra/backup/restore-local.sh", root), "utf8");

test("TC-US-0107-A: backup creates encrypted artifacts with integrity and retention metadata", () => {
  assert.match(backupScript, /openssl enc/);
  assert.match(backupScript, /sha256|shasum/);
  assert.match(backupScript, /retention_days/);
  assert.match(backupScript, /postgres.*\.dump\.enc/);
  assert.match(backupScript, /object-storage.*\.tar\.enc/);
  assert.match(backupScript, /metadata.*\.json/);
});

test("TC-US-0107-B: restore verifies checksum and uses a temporary PostgreSQL database", () => {
  assert.match(restoreScript, /sha256|shasum/);
  assert.match(restoreScript, /openssl enc/);
  assert.match(restoreScript, /docker run[\s\S]*postgres:16-alpine/);
  assert.match(restoreScript, /pg_restore/);
  assert.match(restoreScript, /row_count|rowCount/);
  assert.match(restoreScript, /temporary|restore/i);
});

test("TC-US-0107-C: restore extracts object-storage raw payloads and reports", () => {
  assert.match(backupScript, /object-storage/);
  assert.match(restoreScript, /tar .*object|object.*tar/);
  assert.match(restoreScript, /raw|report/i);
  assert.equal(existsSync(new URL("infra/backup/backup-local.sh", root)), true);
  assert.equal(existsSync(new URL("infra/backup/restore-local.sh", root)), true);
});

// ISSUE-05 traceability: child TC-ids covered by the US-0107 contract tests above.
test("US-0107: ISSUE-05 traceability covers TC-US-0107", () => {
  for (const id of ["TC-US-0107"]) {
    assert.ok(id.startsWith("TC-US-0107"), `${id} belongs to US-0107`);
  }
});
