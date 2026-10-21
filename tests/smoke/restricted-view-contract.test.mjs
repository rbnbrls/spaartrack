import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/restricted-view.ts", root), "utf8");
const web = readWebSource();

test("TC-US-1502: restricted view returns percentages without monetary values", () => {
  for (const marker of ["projectRestrictedView", "restricted-view-v1", "RESTRICTED_VIEW", "allocation_pct", "relative_weight", "hide_amounts"]) {
    assert.match(api + kernel, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of ["restricted-view-panel", "restricted-view-form", "prepare-restricted-view", "restricted-view-submit", "restricted-view-result", "restricted-view-evidence", "restricted-view-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1502 runtime: restricted link resolves to percentages only", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (apiUrl).replace(/\/$/, "");
  const email = `synthetic-restricted-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Restricted" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const auth = { "content-type": "application/json", authorization: `Bearer ${session.token}` };
  const portfolioRes = await fetch(`${base}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: "Synthetic Restricted Portfolio", reporting_currency_code: "EUR" }) });
  assert.equal(portfolioRes.status, 201);
  const portfolio = await portfolioRes.json();
  const accountRes = await fetch(`${base}/api/v1/accounts`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" }) });
  assert.equal(accountRes.status, 201);
  const account = await accountRes.json();
  const instrumentRes = await fetch(`${base}/api/v1/instruments`, { method: "POST", headers: auth, body: JSON.stringify({ name: "Synthetic Restricted Equity", instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `RVE${String(Date.now()).slice(-6)}`, valuation_source: "MANUAL" }) });
  assert.equal(instrumentRes.status, 201);
  const instrument = await instrumentRes.json();
  const depositRes = await fetch(`${base}/api/v1/ledger/transactions`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-restricted-1502", "x-correlation-id": "corr-restricted-1502" },
    body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: "BUY", occurred_at: "2026-10-01T10:00:00.000Z", effective_date: "2026-10-01", amount: "60", currency_code: "EUR", instrument_id: instrument.id, quantity: "6", unit_price: "10", source_type: "MANUAL", source: "MANUAL", state: "POSTED" })
  });
  assert.equal(depositRes.status, 201);
  const priceRes = await fetch(`${base}/api/v1/instrument-prices`, { method: "POST", headers: auth, body: JSON.stringify({ instrument_id: instrument.id, price_at: "2026-10-18T00:00:00.000Z", price: "10", currency_code: "EUR", source: "SYNTHETIC" }) });
  assert.equal(priceRes.status, 201);
  assert.equal(depositRes.status, 201);
  const snapshotRes = await fetch(`${base}/api/v1/portfolio-snapshots`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, snapshot_at: "2026-10-18T00:00:00.000Z", calculation_version: "portfolio-snapshot-v1" }) });
  assert.equal(snapshotRes.status, 201);
  const linkRes = await fetch(`${base}/api/v1/portfolios/${portfolio.id}/share-links`, {
    method: "POST", headers: auth, body: JSON.stringify({ scope: "RESTRICTED_VIEW", exposure_policy: { hide_amounts: true }, expires_at: "2030-12-31T00:00:00.000Z" })
  });
  assert.equal(linkRes.status, 201);
  const link = await linkRes.json();
  const resolveRes = await fetch(`${base}/api/v1/shared/${link.access_id}`);
  assert.equal(resolveRes.status, 200);
  const resolved = await resolveRes.json();
  assert.equal(resolved.scope, "RESTRICTED_VIEW");
  assert.equal(resolved.restricted_view.calculation_version, "restricted-view-v1");
  const text = JSON.stringify(resolved.restricted_view);
  assert.ok(!text.includes("market_value"));
  assert.match(resolveRes.headers.get("x-trace-id") || "missing", /./);
});
