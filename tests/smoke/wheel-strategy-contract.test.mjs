import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/wheel-strategy.ts", root), "utf8");
const web = readFileSync(new URL("apps/web/index.html", root), "utf8");

test("TC-US-1406: wheel cycle links put, shares, covered call and called-away", () => {
  for (const marker of ["/api/v1/wheel-cycles", "wheelCycleRoute", "planWheelCycle", "wheel-strategy-v1", "option-lifecycle-v1", "CASH_SECURED_PUT", "ASSIGNED_SHARES", "COVERED_CALL", "CALLED_AWAY", "trace_id", "correlation_id"]) {
    assert.match(api + kernel, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of ["wheel-strategy-panel", "wheel-strategy-form", "prepare-wheel-strategy", "wheel-strategy-submit", "wheel-strategy-result", "wheel-strategy-evidence", "wheel-strategy-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1406 runtime: wheel cycle plans linked stages without ledger mutation", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (process.env.API_URL || "http://localhost:18080").replace(/\/$/, "");
  const email = `synthetic-wheel-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Wheel" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const res = await fetch(`${base}/api/v1/wheel-cycles`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${session.token}`, "x-trace-id": "trace-wheel-1406", "x-correlation-id": "corr-wheel-1406" },
    body: JSON.stringify({
      events: [
        { leg: "PUT_OPEN", option_type: "PUT", quantity: 1, premium: 2.5, strike: 100, occurred_at: "2026-01-05" },
        { leg: "PUT_ASSIGNMENT", option_type: "PUT", quantity: 1, strike: 100, occurred_at: "2026-02-01" },
        { leg: "CALL_OPEN", option_type: "CALL", quantity: 1, premium: 3, strike: 105, occurred_at: "2026-02-03" },
        { leg: "CALL_CALLED_AWAY", option_type: "CALL", quantity: 1, strike: 105, occurred_at: "2026-03-01" }
      ]
    })
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.linked, true);
  assert.equal(body.calculation_version, "wheel-strategy-v1");
  assert.equal(body.read_only, true);
  assert.match(res.headers.get("x-trace-id") || "", /trace-wheel-1406/);
});
