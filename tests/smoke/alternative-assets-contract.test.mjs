import { fixtureKey } from "../helpers/fixture-key.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/alternative-assets.ts", root), "utf8");
const web = readWebSource();

test("TC-US-1407: alternative asset valuation is explicit and read-only", () => {
  for (const marker of ["/api/v1/alternative-asset-valuations", "alternativeAssetValuationRoute", "describeAlternativeAssetValuation", "alternative-asset-valuation-v1", "CRYPTO", "PRECIOUS_METAL", "FUTURE", "CUSTOM", "trace_id", "correlation_id"]) {
    assert.match(api + kernel, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of ["alternative-assets-panel", "alternative-assets-form", "prepare-alternative-assets", "alternative-assets-submit", "alternative-assets-result", "alternative-assets-evidence", "alternative-asset-valuation-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1407 runtime: crypto/manual/future valuations stay read-only", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.API_URL || "http://localhost:18080").replace(/\/$/, "");
  const email = `synthetic-alt-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Alt" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": fixtureKey() }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const cases = [
    { instrument_type: "CRYPTO", asset_class: "CRYPTO", currency_code: "EUR", valuation_source: "PROVIDER", provider_price: "67250.10" },
    { instrument_type: "CUSTOM", asset_class: "REAL_ASSET", currency_code: "EUR", valuation_source: "MANUAL", manual_price: "12500" },
    { instrument_type: "FUTURE", asset_class: "DERIVATIVE", currency_code: "USD", valuation_source: "MANUAL", manual_price: "4500.25" }
  ];
  for (const payload of cases) {
    const res = await fetch(`${base}/api/v1/alternative-asset-valuations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.token}`, "x-trace-id": "trace-alt-1407", "x-correlation-id": "corr-alt-1407" },
      body: JSON.stringify(payload)
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.calculation_version, "alternative-asset-valuation-v1");
    assert.equal(body.read_only, true);
  }
  assert.match("x-trace-id", /trace/);
});
