import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");

// Every INSERT ... ON CONFLICT (<cols>) in the API needs a unique index over
// exactly those columns. PostgreSQL raises
//   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
// when it is missing, and the API turns that into a 400 instead of the 201 the
// contract tests assert. A fresh schema.sql bootstrap must therefore carry the
// uniqueness, whether it is declared inline or as a named index.
function onConflictTargets() {
  const statements = apiSource.split(/;\s*\n/);
  const targets = new Map();
  for (const statement of statements) {
    const table = statement.match(/INSERT INTO spaartrack\.(\w+)/);
    const conflict = statement.match(/ON CONFLICT \(([^)]*)\)/);
    if (!table || !conflict) continue;
    const columns = conflict[1].split(",").map((column) => column.trim()).sort();
    const key = table[1];
    if (!targets.has(key)) targets.set(key, new Set());
    targets.get(key).add(columns.join(","));
  }
  return targets;
}

// Collect every column set that is unique for a table in schema.sql:
// the primary key, inline UNIQUE (...) clauses and named unique indexes.
function uniqueColumnSets(schema) {
  const sets = new Map();
  const add = (table, columns) => {
    if (!table) return;
    const key = table.toLowerCase();
    if (!sets.has(key)) sets.set(key, new Set());
    sets.get(key).add(columns.split(",").map((column) => column.trim()).sort().join(","));
  };

  const withoutSchemaPrefix = schema.replace(/spaartrack\./gi, "");

  // CREATE TABLE x (...) with inline PRIMARY KEY (...) / UNIQUE (...)
  for (const match of withoutSchemaPrefix.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)\s*\(([\s\S]*?)\n\);/g)) {
    const [, table, body] = match;
    for (const inline of body.matchAll(/(?:PRIMARY KEY|UNIQUE)\s*\(([^)]*)\)/gi)) {
      add(table, inline[1]);
    }
    // Column-level `col ... UNIQUE` and `col ... PRIMARY KEY` are single-column
    // unique sets in their own right.
    for (const column of body.matchAll(/^\s*(\w+)\s+[a-z]+[^,\n]*\b(UNIQUE|PRIMARY KEY)\b/gim)) {
      add(table, column[1]);
    }
  }

  // CREATE UNIQUE INDEX name ON table (columns)
  for (const match of withoutSchemaPrefix.matchAll(/CREATE UNIQUE INDEX(?: IF NOT EXISTS)?\s+\w+\s*\n?\s*ON\s+(\w+)\s*\(([^)]*)\)/gi)) {
    add(match[1], match[2]);
  }

  return sets;
}

test("TC-US-0602-SCHEMA: schema.sql declares the uniqueness every ON CONFLICT target the API uses requires", () => {
  const unique = uniqueColumnSets(schemaSource);
  const missing = [];
  for (const [table, columnSets] of onConflictTargets()) {
    const declared = unique.get(table.toLowerCase()) || new Set();
    for (const columns of columnSets) {
      const wanted = columns.split(",").map((column) => column.trim()).sort().join(",");
      if (!declared.has(wanted)) missing.push(`${table} ON CONFLICT (${columns})`);
    }
  }
  assert.deepEqual(missing, [], `schema.sql is missing the unique index these ON CONFLICT targets require:\n${missing.join("\n")}`);
});

test("TC-US-0602-SCHEMA: a fresh schema.sql bootstrap applies cleanly and creates the import-mapping versioning index", { skip: process.env.STACK_SMOKE !== "1" }, () => {
  // Throwaway container with its own volume: schema.sql must apply cleanly on
  // a database that has never seen it before.
  const name = `qa-schema-probe-${process.pid}-${Date.now()}`;
  const schemaPath = new URL("database/schema.sql", root).pathname;
  const run = (args, timeout = 180_000) => spawnSync("docker", args, { encoding: "utf8", timeout });

  const started = run([
    "run", "-d", "--name", name,
    "-e", "POSTGRES_DB=spaartrack",
    "-e", "POSTGRES_USER=spaartrack",
    "-e", "POSTGRES_PASSWORD=qa-iso-only",
    "-v", `${schemaPath}:/docker-entrypoint-initdb.d/001-schema.sql:ro`,
    "postgres:16-alpine",
  ]);
  assert.equal(started.status, 0, `could not start the probe database: ${started.stderr}`);

  try {
    // The postgres entrypoint starts a TEMPORARY server to run the init
    // scripts and then restarts. pg_isready answers during that temporary
    // phase, so readiness must be proven by the schema actually being
    // present, not by the port accepting connections.
    let applied = false;
    let lastOutput = "";
    for (let attempt = 0; attempt < 90 && !applied; attempt += 1) {
      const probe = run([
        "exec", name, "psql", "-U", "spaartrack", "-d", "spaartrack", "-tAc",
        "select count(*) from pg_indexes where schemaname='spaartrack' and indexname='import_mapping_owner_name_version_idx'",
      ], 30_000);
      lastOutput = `${probe.stdout || ""}${probe.stderr || ""}`;
      if (probe.status === 0 && probe.stdout.trim() === "1") applied = true;
      else spawnSync("sleep", ["1"]);
    }
    assert.ok(applied, `fresh bootstrap did not create import_mapping_owner_name_version_idx:\n${lastOutput}`);

    // The bootstrap must have applied without a fatal error.
    const errors = run(["logs", name]);
    assert.doesNotMatch(errors.stdout || "", /FATAL|ERROR:/, `schema.sql failed on a fresh database:\n${errors.stdout}`);
  } finally {
    run(["rm", "-f", name], 60_000);
  }
});
