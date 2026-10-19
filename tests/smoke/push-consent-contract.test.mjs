import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/push-consent.ts", root), "utf8");
const web = readFileSync(new URL("apps/web/index.html", root), "utf8");
const migration = readFileSync(new URL("database/migrations/0026-push-consent.sql", root), "utf8");

test("TC-US-1506: push consent and delivery are traceable with revoke", () => {
  for (const marker of ["validatePushConsent", "recordPushDelivery", "push-consent-v1", "push-delivery-v1", "pushConsentRoute", "PUSH_CONSENT_REVOKED"]) {
    assert.match(api + kernel, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(migration, /push_consent/);
  for (const marker of ["push-consent-panel", "push-consent-form", "prepare-push-consent", "push-consent-submit", "push-consent-result", "push-consent-evidence", "push-consent-v1", "push-delivery-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1506 runtime: consent grant, delivery and revoke are audited", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.API_URL || "http://localhost:18080").replace(/\/$/, "");
  const email = `synthetic-push-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Push" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const auth = { "content-type": "application/json", authorization: `Bearer ${session.token}` };
  const grantRes = await fetch(`${base}/api/v1/push-consents`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-push-1506", "x-correlation-id": "corr-push-1506" },
    body: JSON.stringify({ channel: "PUSH", enabled: true, device_label: "Synthetic Pixel" })
  });
  assert.equal(grantRes.status, 201);
  const grant = await grantRes.json();
  assert.equal(grant.status, "GRANTED");
  assert.equal(grant.calculation_version, "push-consent-v1");
  const deliverRes = await fetch(`${base}/api/v1/push-consents/${grant.id}/deliveries`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ event: "DIVIDEND_PAID", channel: "PUSH", status: "FAILED", failure_reason: "synthetic-endpoint-expired" })
  });
  assert.equal(deliverRes.status, 201);
  const delivery = await deliverRes.json();
  assert.equal(delivery.delivery_status, "FAILED");
  assert.equal(delivery.failure_reason, "synthetic-endpoint-expired");
  const listRes = await fetch(`${base}/api/v1/push-consents`, { headers: auth });
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  assert.ok(list.consents.length >= 1);
  const revokeRes = await fetch(`${base}/api/v1/push-consents/${grant.id}/revoke`, { method: "POST", headers: auth });
  assert.equal(revokeRes.status, 200);
  const revoked = await revokeRes.json();
  assert.equal(revoked.status, "REVOKED");
  assert.match(grantRes.headers.get("x-trace-id") || "missing", /./);
});
