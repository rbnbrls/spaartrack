import test from "node:test";
import assert from "node:assert/strict";
import { buildAddonSdkRead, validateAddonEventHook } from "../../apps/api/src/addon-sdk.ts";

test("TC-US-1607-A: typed read API exposes only the granted resource", () => {
  const result = buildAddonSdkRead({ permissions: ["PORTFOLIO_READ"], resource: "portfolio" });
  assert.equal(result.resource, "portfolio");
  assert.equal(result.capability, "read_portfolio");
  assert.equal(result.calculation_version, "addon-sdk-v1");
  assert.equal(result.read_only, true);
  assert.equal(result.ledger_access, "none");
  assert.throws(() => buildAddonSdkRead({ permissions: ["PORTFOLIO_READ"], resource: "activities" }), /ADDON_SCOPE_DENIED/);
});

test("TC-US-1607-B: event hook validation is typed and revokeable", () => {
  assert.deepEqual(validateAddonEventHook({ event_name: "PORTFOLIO_UPDATED", registered_events: ["PORTFOLIO_UPDATED"] }), { event_name: "PORTFOLIO_UPDATED", status: "ACTIVE" });
  assert.throws(() => validateAddonEventHook({ event_name: "SECRET_EXPOSED", registered_events: ["PORTFOLIO_UPDATED"] }), /ADDON_EVENT_NOT_GRANTED/);
  assert.throws(() => validateAddonEventHook({ event_name: "bad event", registered_events: ["bad event"] }), /INVALID_ADDON_EVENT/);
});
