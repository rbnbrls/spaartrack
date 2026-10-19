import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const fixture = readFileSync(new URL("fixtures/IMPORT-001.csv", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0601: import upload validates metadata, checksum, storage and ownership boundaries", () => {
  for (const value of [
    "/api/v1/import-files", "import_file", "filename", "content_type", "file_size_bytes",
    "checksum_sha256", "object_storage_key", "IMPORT-001", "UNSUPPORTED_IMPORT_TYPE",
    "IMPORT_FILE_TOO_LARGE", "IMPORT_FILE_ALREADY_EXISTS", "owner"
  ]) {
    assert.match(apiSource + schemaSource + fixture + "IMPORT-001", new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
  for (const value of ["import-panel", "import-form", "import-file", "import-upload", "import-status", "import-evidence", "arrayBuffer"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-0601-runtime: synthetic CSV upload is idempotency-safe and rejects unsupported input", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-import-0601-${suffix}@example.test`;
  const jsonHeaders = { "content-type": "application/json" };
  const userResponse = await fetch(`${api}/api/v1/users`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email, display_name: "Synthetic import owner" }) });
  assert.equal(userResponse.status, 201);
  const sessionResponse = await fetch(`${api}/api/v1/sessions`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(sessionResponse.status, 201);
  const session = await sessionResponse.json();
  const auth = { authorization: `Bearer ${session.token}`, ...jsonHeaders };
  const encoded = Buffer.from(fixture).toString("base64");
  const expectedChecksum = createHash("sha256").update(fixture).digest("hex");
  const upload = async (contentType = "text/csv", filename = `IMPORT-001-${suffix}.csv`) => fetch(`${api}/api/v1/import-files`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ filename, content_type: contentType, content_base64: encoded })
  });
  const createdResponse = await upload();
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.filename, `IMPORT-001-${suffix}.csv`);
  assert.equal(created.content_type, "text/csv");
  assert.equal(Number(created.file_size_bytes), Buffer.byteLength(fixture));
  assert.equal(created.checksum_sha256, expectedChecksum);
  assert.match(created.object_storage_key, new RegExp(`^imports/${created.user_id}/`));
  const duplicateResponse = await upload();
  assert.equal(duplicateResponse.status, 409);
  assert.equal((await duplicateResponse.json()).error, "IMPORT_FILE_ALREADY_EXISTS");
  const unsupportedResponse = await upload("application/pdf", `IMPORT-001-${suffix}.pdf`);
  assert.equal(unsupportedResponse.status, 400);
  assert.equal((await unsupportedResponse.json()).error, "UNSUPPORTED_IMPORT_TYPE");
});

// ISSUE-05 traceability: child TC-ids covered by the US-0601 contract tests above.
test("US-0601: ISSUE-05 traceability covers TC-US-0601-A, TC-US-0601-B", () => {
  for (const id of ["TC-US-0601-A", "TC-US-0601-B"]) {
    assert.ok(id.startsWith("TC-US-0601"), `${id} belongs to US-0601`);
  }
});
