import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../..", import.meta.url);
const bootstrapDocs = readFileSync(new URL("migrations/README.md", root), "utf8");
const composeSource = readFileSync(new URL("compose.yaml", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const importMappingMigration = readFileSync(new URL("database/migrations/0009-import-mapping-versioning.sql", root), "utf8");
const syncReviewMigration = readFileSync(new URL("database/migrations/0012-sync-result-review.sql", root), "utf8");
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");

const normalizeDdl = (statement) => statement
  .replace(/CREATE TABLE IF NOT EXISTS/i, "CREATE TABLE")
  .replace(/CREATE UNIQUE INDEX IF NOT EXISTS/i, "CREATE UNIQUE INDEX")
  .replace(/CREATE INDEX IF NOT EXISTS/i, "CREATE INDEX")
  .replace(/spaartrack\./g, "")
  .replace(/\s+/g, " ")
  .trim()
  .replace(/;$/, "");

const migrationIndex = importMappingMigration.match(/CREATE UNIQUE INDEX IF NOT EXISTS import_mapping_owner_name_version_idx[\s\S]*?;/i)?.[0];
const migrationTable = syncReviewMigration.match(/CREATE TABLE IF NOT EXISTS spaartrack\.sync_result_item[\s\S]*?\n\);/i)?.[0];

test("fresh schema bootstrap includes runtime-required migration contracts", () => {
  assert.match(bootstrapDocs, /Compose-bootstrap gebruikt voorlopig database\/schema\.sql/);
  assert.match(composeSource, /database\/schema\.sql:\/docker-entrypoint-initdb\.d\/001-schema\.sql/);

  assert.ok(migrationIndex, "versioned import-mapping index must exist");
  assert.ok(migrationTable, "versioned sync review table must exist");
  assert.ok(normalizeDdl(schemaSource).includes(normalizeDdl(migrationIndex)), "fresh schema index must match migration 0009");
  assert.ok(normalizeDdl(schemaSource).includes(normalizeDdl(migrationTable)), "fresh schema table contract must match migration 0012");

  assert.match(apiSource, /INSERT INTO spaartrack\.import_mapping[\s\S]*?ON CONFLICT \(user_id, name, template_version\)/);
  assert.match(apiSource, /INSERT INTO spaartrack\.sync_result_item/);
  assert.match(apiSource, /SELECT sri\.external_id FROM spaartrack\.sync_result_item/);
});

test("TC-US-0602: fresh schema ships the import-mapping unique index the ON CONFLICT clause depends on", () => {
  assert.ok(migrationIndex, "versioned import-mapping index must exist");
  assert.ok(
    normalizeDdl(schemaSource).includes(normalizeDdl(migrationIndex)),
    "database/schema.sql must carry migration 0009's import_mapping_owner_name_version_idx"
  );

  const schemaIndex = schemaSource.match(/CREATE UNIQUE INDEX IF NOT EXISTS import_mapping_owner_name_version_idx[\s\S]*?;/i)?.[0];
  assert.ok(schemaIndex, "database/schema.sql must declare import_mapping_owner_name_version_idx");
  assert.match(schemaIndex, /IF NOT EXISTS/i, "the fresh-schema index must be idempotent so schema.sql can be re-applied");
  assert.match(schemaIndex, /ON spaartrack\.import_mapping \(user_id, name, template_version\)/i);

  const indexColumns = schemaIndex.match(/\(([^)]*)\)/i)?.[1].split(",").map((column) => column.trim());
  const importMappingInsert = apiSource.match(/INSERT INTO spaartrack\.import_mapping[\s\S]*?;/i)?.[0];
  assert.ok(importMappingInsert, "the API must insert into spaartrack.import_mapping");
  const conflictColumns = importMappingInsert.match(/ON CONFLICT \(([^)]*)\)/i)?.[1].split(",").map((column) => column.trim());
  assert.ok(conflictColumns, "the import_mapping insert must carry an ON CONFLICT column list");
  assert.deepEqual(
    indexColumns,
    conflictColumns,
    "the unique index columns must match the API ON CONFLICT column list and order"
  );
});

// Runtime proof of the clean-bootstrap contract: a fresh, empty PostgreSQL 16 database is
// initialized from database/schema.sql only (no migrations), after which the index must
// exist as a UNIQUE index and the API's ON CONFLICT insert must be accepted.
// Runs only when SCHEMA_BOOTSTRAP_RUNTIME=1 so the default suite stays offline.
test("TC-US-0602-runtime: a schema-only bootstrap exposes the unique index and accepts the ON CONFLICT insert", { skip: process.env.SCHEMA_BOOTSTRAP_RUNTIME !== "1" }, async () => {
  const suffix = `${process.pid}-${Math.random().toString(16).slice(2, 8)}`;
  const container = `spaartrack-bootstrap-${suffix}`;
  const docker = (args) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const psql = (args) => docker(["exec", container, "psql", "-U", "spaartrack", "-d", "spaartrack", "-v", "ON_ERROR_STOP=1", ...args]);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    docker([
      "run", "-d", "--rm", "--name", container,
      "-e", "POSTGRES_USER=spaartrack",
      "-e", "POSTGRES_DB=spaartrack",
      "-e", "POSTGRES_PASSWORD=synthetic-local-only",
      "postgres:16-alpine"
    ]);

    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      try {
        docker(["exec", container, "pg_isready", "-U", "spaartrack", "-d", "spaartrack"]);
        ready = true;
      } catch {
        await sleep(1000);
      }
    }
    assert.ok(ready, "the disposable PostgreSQL 16 container must become ready");

    docker(["cp", fileURLToPath(new URL("database/schema.sql", root)), `${container}:/schema.sql`]);
    psql(["-f", "/schema.sql"]);

    const indexDefinition = psql([
      "-tAc",
      "select pg_get_indexdef(indexrelid) from pg_index where indexrelid = 'spaartrack.import_mapping_owner_name_version_idx'::regclass"
    ]).trim();
    assert.match(indexDefinition, /^CREATE UNIQUE INDEX import_mapping_owner_name_version_idx ON spaartrack\.import_mapping USING btree \(user_id, name, template_version\)$/);

    psql(["-c", "insert into spaartrack.app_user (id, display_name) values ('11111111-1111-4111-8111-111111111111', 'synthetic bootstrap owner')"]);
    psql(["-c", "insert into spaartrack.import_mapping (user_id, name, document_type, parser_version, mapping_json) values ('11111111-1111-4111-8111-111111111111', 'synthetic-template', 'TRANSACTIONS', 'v1', '{}') on conflict (user_id, name, template_version) do nothing"]);
    const duplicate = psql(["-tAc", "insert into spaartrack.import_mapping (user_id, name, document_type, parser_version, mapping_json) values ('11111111-1111-4111-8111-111111111111', 'synthetic-template', 'TRANSACTIONS', 'v1', '{}') on conflict (user_id, name, template_version) do nothing"]);
    assert.match(duplicate, /INSERT 0 0/, "the unique index must back the ON CONFLICT specification");
  } finally {
    try {
      docker(["rm", "-f", container]);
    } catch {
      // the container may already be gone; the assertion failure above carries the evidence
    }
  }
});
