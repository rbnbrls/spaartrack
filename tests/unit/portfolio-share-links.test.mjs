import test from "node:test";
import assert from "node:assert/strict";
import { buildPortfolioShareLink } from "../../apps/api/src/portfolio-share-links.ts";

test("US-1501 unit: read-only link carries access id, scope, exposure policy and expiry", () => {
  const link = buildPortfolioShareLink(
    { scope: "VIEW", exposure_policy: { hide_amounts: false }, expires_at: "2030-12-31T00:00:00.000Z" },
    "2026-10-18T00:00:00.000Z"
  );
  assert.match(link.access_id, /^[A-Za-z0-9_-]{12,}$/);
  assert.equal(link.scope, "VIEW");
  assert.equal(link.exposure_policy.hide_amounts, false);
  assert.equal(link.status, "ACTIVE");
  assert.equal(link.calculation_version, "portfolio-share-link-v1");
  assert.equal(link.read_only, true);
});

test("US-1501 unit: restricted view hides monetary values via exposure policy", () => {
  const link = buildPortfolioShareLink(
    { scope: "RESTRICTED_VIEW", exposure_policy: { hide_amounts: true }, expires_at: "2030-12-31T00:00:00.000Z" },
    "2026-10-18T00:00:00.000Z"
  );
  assert.equal(link.scope, "RESTRICTED_VIEW");
  assert.equal(link.exposure_policy.hide_amounts, true);
});

test("US-1501 unit: expired link is reported expired server-side", () => {
  const link = buildPortfolioShareLink(
    { scope: "VIEW", exposure_policy: {}, expires_at: "2020-01-01T00:00:00.000Z" },
    "2026-10-18T00:00:00.000Z"
  );
  assert.equal(link.status, "EXPIRED");
});

test("US-1501 unit: invalid scope and past expiry are rejected", () => {
  assert.throws(() => buildPortfolioShareLink({ scope: "MANAGE", exposure_policy: {}, expires_at: null }, "2026-10-18T00:00:00.000Z"), /INVALID_SHARE_LINK/);
  assert.throws(() => buildPortfolioShareLink({ scope: "VIEW", exposure_policy: {}, expires_at: "not-a-date" }, "2026-10-18T00:00:00.000Z"), /INVALID_SHARE_LINK/);
});
