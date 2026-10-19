import test from "node:test";
import assert from "node:assert/strict";
import { validatePushConsent, recordPushDelivery } from "../../apps/api/src/push-consent.ts";

test("TC-US-1506-A: push consent stores channel preference and revoke", () => {
  const consent = validatePushConsent({ channel: "PUSH", enabled: true, device_label: "Synthetic Pixel" });
  assert.equal(consent.channel, "PUSH");
  assert.equal(consent.status, "GRANTED");
  assert.equal(consent.calculation_version, "push-consent-v1");
  const revoked = validatePushConsent({ channel: "PUSH", enabled: false, device_label: "Synthetic Pixel" });
  assert.equal(revoked.status, "REVOKED");
  assert.throws(() => validatePushConsent({ channel: "SMS", enabled: true }), /INVALID_PUSH_CONSENT/);
});

test("TC-US-1506-B: push delivery records event, channel, status and failure", () => {
  const ok = recordPushDelivery({ event: "DIVIDEND_PAID", channel: "PUSH", status: "DELIVERED" });
  assert.equal(ok.delivery_status, "DELIVERED");
  assert.equal(ok.channel, "PUSH");
  const failed = recordPushDelivery({ event: "DIVIDEND_PAID", channel: "PUSH", status: "FAILED", failure_reason: "synthetic-endpoint-expired" });
  assert.equal(failed.delivery_status, "FAILED");
  assert.equal(failed.failure_reason, "synthetic-endpoint-expired");
  assert.equal(failed.calculation_version, "push-delivery-v1");
  assert.throws(() => recordPushDelivery({ event: "", channel: "PUSH", status: "DELIVERED" }), /INVALID_PUSH_DELIVERY/);
});
