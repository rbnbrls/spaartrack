import test from "node:test";
import assert from "node:assert/strict";
import { buildAccountantShare, revokeAccountantShare } from "../../apps/api/src/accountant-access.ts";

test("US-1107 unit: accountant/advisor share requires bounded scope and future expiry", () => {
  const share = buildAccountantShare({
    grantee_email: "advisor@example.test",
    role: "ADVISOR",
    scope: ["PORTFOLIO_READ", "REPORTS_READ"],
    expires_at: "2030-12-31T23:59:59.000Z"
  }, "2026-10-18T00:00:00.000Z");
  assert.equal(share.role, "ADVISOR");
  assert.deepEqual(share.scope, ["PORTFOLIO_READ", "REPORTS_READ"]);
  assert.equal(share.status, "ACTIVE");
  assert.throws(() => buildAccountantShare({ grantee_email: "not-an-email", role: "ADVISOR", scope: ["PORTFOLIO_READ"], expires_at: "2030-01-01T00:00:00.000Z" }, "2026-10-18T00:00:00.000Z"), /INVALID_EMAIL/);
  assert.throws(() => buildAccountantShare({ grantee_email: "advisor@example.test", role: "EDITOR", scope: ["PORTFOLIO_READ"], expires_at: "2030-01-01T00:00:00.000Z" }, "2026-10-18T00:00:00.000Z"), /INVALID_ROLE/);
  assert.throws(() => buildAccountantShare({ grantee_email: "advisor@example.test", role: "ADVISOR", scope: ["SECRET_READ"], expires_at: "2030-01-01T00:00:00.000Z" }, "2026-10-18T00:00:00.000Z"), /INVALID_SCOPE/);
  assert.throws(() => buildAccountantShare({ grantee_email: "advisor@example.test", role: "ADVISOR", scope: ["PORTFOLIO_READ"], expires_at: "2026-01-01T00:00:00.000Z" }, "2026-10-18T00:00:00.000Z"), /EXPIRY_IN_PAST/);
});

test("US-1107 unit: revoke is idempotent and preserves audit state", () => {
  const revoked = revokeAccountantShare({ id: "share-1", status: "ACTIVE" }, "2026-10-18T01:00:00.000Z");
  assert.equal(revoked.status, "REVOKED");
  assert.equal(revoked.revoked_at, "2026-10-18T01:00:00.000Z");
  assert.equal(revoked.audit_action, "REVOKE");
  assert.deepEqual(revokeAccountantShare(revoked, "2026-10-18T02:00:00.000Z"), revoked);
});
