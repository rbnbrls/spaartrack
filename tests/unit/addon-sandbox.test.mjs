import test from "node:test";
import assert from "node:assert/strict";
import { validateAddonManifest, buildAddonSandboxPlan } from "../../apps/api/src/addon-sandbox.ts";

test("TC-US-1606-A: addon manifest validates schema and permissions without secrets", () => {
  const manifest = validateAddonManifest({
    slug: "synthetic-addon",
    name: "Synthetic Addon",
    version: "1.0.0",
    permissions: ["PORTFOLIO_READ", "MARKET_DATA_READ"],
    entrypoints: { ui: "dist/ui.js", events: ["PORTFOLIO_UPDATED"] },
    secrets: [{ name: "market-key", vault_path: "vault://synthetic/addons/market-key" }],
    assets: [{ path: "assets/logo.svg", content_type: "image/svg+xml", sha256: "a".repeat(64) }]
  });

  assert.equal(manifest.calculation_version, "addon-manifest-v1");
  assert.equal(manifest.source, "addon_manifest");
  assert.deepEqual(manifest.permissions, ["PORTFOLIO_READ", "MARKET_DATA_READ"]);
  assert.equal(manifest.secrets[0].key_material, "vault-only");
  assert.ok(!("value" in manifest.secrets[0]));
  assert.equal(manifest.read_only, false);
});

test("TC-US-1606-A: invalid permissions, entrypoints and raw secret values are rejected", () => {
  assert.throws(() => validateAddonManifest({
    slug: "bad addon", name: "Bad", version: "1.0.0", permissions: ["MANAGE_LEDGER"], entrypoints: { ui: "x.js" }
  }), /INVALID_ADDON_MANIFEST/);
  assert.throws(() => validateAddonManifest({
    slug: "bad-secret", name: "Bad", version: "1.0.0", permissions: ["PORTFOLIO_READ"], entrypoints: { ui: "x.js" },
    secrets: [{ name: "key", vault_path: "vault://x", value: "raw-secret" }]
  }), /INVALID_ADDON_MANIFEST/);
});

test("TC-US-1606-B: sandbox plan is isolated and revokeable", () => {
  const plan = buildAddonSandboxPlan({
    addon_id: "00000000-0000-0000-0000-000000000001",
    permissions: ["PORTFOLIO_READ"],
    assets: ["assets/logo.svg"],
    event_hooks: ["PORTFOLIO_UPDATED"]
  });
  assert.equal(plan.calculation_version, "addon-sandbox-v1");
  assert.equal(plan.isolation, "addon-sandbox");
  assert.deepEqual(plan.granted_permissions, ["PORTFOLIO_READ"]);
  assert.deepEqual(plan.asset_root, "addon://00000000-0000-0000-0000-000000000001/assets");
  assert.equal(plan.status, "STOPPED");
  assert.equal(plan.revokable, true);
  assert.equal(plan.ledger_access, "none");
});
