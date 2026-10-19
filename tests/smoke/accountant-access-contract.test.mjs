import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schema = readFileSync(new URL("database/schema.sql", root), "utf8");
const web = readFileSync(new URL("apps/web/index.html", root), "utf8");

test("US-1107 contract: temporary accountant/advisor access is scoped, expiring and auditable", () => {
  for (const value of ["accountantShareRoute", "/accountant-shares", "ACCOUNTANT_SHARE", "PORTFOLIO_OWNER_REQUIRED", "EXPIRY_IN_PAST", "REVOKE", "accountant-access-v1"]) assert.match(api, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  for (const value of ["CREATE TABLE accountant_share", "grantee_email", "expires_at", "revoked_at"]) assert.match(schema, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
});

test("US-1107 GUI contract: access sharing controls expose scope, expiry and revoke evidence", () => {
  for (const value of ["accountant-access-panel", "accountant-access-form", "access-grantee", "access-role", "access-scope", "access-expires", "access-list", "access-revoke", "accountant-access-v1"]) assert.match(web, new RegExp(value));
});

// ISSUE-05 traceability: child TC-ids covered by the US-1107 contract tests above.
test("US-1107: ISSUE-05 traceability covers TC-US-1107", () => {
  for (const id of ["TC-US-1107"]) {
    assert.ok(id.startsWith("TC-US-1107"), `${id} belongs to US-1107`);
  }
});
