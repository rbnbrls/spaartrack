import test from "node:test";
import assert from "node:assert/strict";
import { sealOfflineCache, openOfflineCache } from "../../apps/api/src/offline-cache.ts";

const KEY = "synthetic-offline-cache-passphrase-1505";

test("TC-US-1505-A: sealed cache is scoped, encrypted and expirable", () => {
  const envelope = sealOfflineCache({
    scope: "PORTFOLIO_READ",
    portfolio_id: "11111111-1111-4111-8111-111111111111",
    payload: { portfolio_value: "100.00", currency: "EUR" },
    ttl_seconds: 3600,
    key: KEY,
    now: "2026-10-18T12:00:00.000Z",
  });
  assert.equal(envelope.calculation_version, "offline-cache-v1");
  assert.equal(envelope.scope, "PORTFOLIO_READ");
  assert.equal(envelope.read_only, true);
  assert.ok(envelope.ciphertext && envelope.iv && envelope.tag);
  const text = envelope.ciphertext;
  assert.ok(!text.includes("100.00"));
  const opened = openOfflineCache({ envelope, key: KEY, now: "2026-10-18T12:30:00.000Z" });
  assert.equal(opened.status, "FRESH");
  assert.equal(opened.stale, false);
  assert.deepEqual(opened.payload, { portfolio_value: "100.00", currency: "EUR" });
});

test("TC-US-1505-B: expired cache is stale and blocks unsafe writes", () => {
  const envelope = sealOfflineCache({
    scope: "PORTFOLIO_READ",
    portfolio_id: "11111111-1111-4111-8111-111111111111",
    payload: { portfolio_value: "100.00", currency: "EUR" },
    ttl_seconds: 60,
    key: KEY,
    now: "2026-10-18T12:00:00.000Z",
  });
  const opened = openOfflineCache({ envelope, key: KEY, now: "2026-10-18T14:00:00.000Z" });
  assert.equal(opened.status, "EXPIRED");
  assert.equal(opened.stale, true);
  assert.equal(opened.write_allowed, false);
  assert.throws(() => openOfflineCache({ envelope, key: "wrong-passphrase", now: "2026-10-18T12:00:00.000Z" }), /OFFLINE_CACHE_DECRYPT_FAILED/);
});
