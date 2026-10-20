import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const adrSource = readFileSync(new URL("docs/adr/0002-canonical-ledger.md", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0407: portfolio snapshot contract is explicit and rebuildable", () => {
  for (const value of [
    "/api/v1/portfolio-snapshots", "portfolio_snapshot", "position_snapshot", "portfolio_value",
    "invested_capital", "free_cash", "net_cash_flow", "price_data_as_of", "fx_data_as_of",
    "calculation_version"
  ]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(adrSource, /ledger_transaction en ledger_entry zijn de financiële bron van waarheid/);
});

test("TC-US-0407-runtime: snapshot contains value, cash, flows, P&L and as-of evidence", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-snapshot-0407-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic Snapshot" })
  });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" },
    body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ name: `Synthetic Snapshot ${suffix}`, reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic Snapshot Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" })
  });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();
  const instrumentResponse = await fetch(`${api}/api/v1/instruments`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ name: `Synthetic Snapshot Equity ${suffix}`, instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `SNP${String(Date.now()).slice(-6)}`, valuation_source: "MANUAL" })
  });
  assert.equal(instrumentResponse.status, 201);
  const instrument = await instrumentResponse.json();

  const post = async (payload) => {
    const response = await fetch(`${api}/api/v1/ledger/transactions`, {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, source_type: "MANUAL", state: "POSTED", currency_code: "EUR", ...payload })
    });
    assert.equal(response.status, 201);
    return response.json();
  };
  await post({ activity_type: "DEPOSIT", occurred_at: "2026-04-01T10:00:00.000Z", effective_date: "2026-04-01", amount: "100" });
  await post({ activity_type: "BUY", occurred_at: "2026-04-02T10:00:00.000Z", effective_date: "2026-04-02", amount: "50", instrument_id: instrument.id, quantity: "5", unit_price: "10" });
  const price = await fetch(`${api}/api/v1/instrument-prices`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ instrument_id: instrument.id, price_at: "2026-04-03T16:00:00.000Z", price: "12", currency_code: "EUR", source: "SYNTHETIC", is_close: true })
  });
  assert.equal(price.status, 201);

  const snapshotResponse = await fetch(`${api}/api/v1/portfolio-snapshots`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ portfolio_id: portfolio.id, snapshot_at: "2026-04-03T17:00:00.000Z", calculation_version: "snapshot-test-v1" })
  });
  assert.equal(snapshotResponse.status, 201);
  const snapshot = await snapshotResponse.json();
  assert.equal(snapshot.snapshot_at, "2026-04-03T17:00:00.000Z");
  assert.equal(snapshot.portfolio_value, "110.000000000000");
  assert.equal(snapshot.free_cash, "50.000000000000");
  assert.equal(snapshot.net_cash_flow, "100.000000000000");
  assert.equal(snapshot.unrealized_pnl, "10.000000000000");
  assert.equal(snapshot.price_data_as_of, "2026-04-03T16:00:00.000Z");
  assert.equal(snapshot.calculation_version, "snapshot-test-v1");
  assert.equal(snapshot.positions.length, 1);
  assert.equal(snapshot.positions[0].quantity, "5.000000000000");
  assert.equal(snapshot.positions[0].market_value, "60.000000000000");

  const readBack = await fetch(`${api}/api/v1/portfolio-snapshots?portfolio_id=${portfolio.id}`, { headers: auth });
  assert.equal(readBack.status, 200);
  assert.equal((await readBack.json()).snapshots.length, 1);
});
