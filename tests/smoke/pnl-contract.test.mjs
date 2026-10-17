import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const adrSource = readFileSync(new URL("docs/adr/0002-canonical-ledger.md", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0405: P&L contract separates price, FX, fees and taxes", () => {
  for (const value of [
    "/api/v1/pnl", "price_pnl", "fx_pnl", "realized_pnl", "unrealized_pnl", "fees", "taxes",
    "valuation_price", "valuation_fx_rate", "cost_basis_fx_rate", "calculation_version"
  ]) {
    assert.match(apiSource + schemaSource + adrSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(adrSource, /ledger_transaction en ledger_entry zijn de financiële bron van waarheid/);
});

test("TC-US-0405-runtime: realized and unrealized P&L golden case explains price, FX, fees and taxes", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-pnl-0405-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic P&L" })
  });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/sessions`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ name: `Synthetic P&L ${suffix}`, reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic P&L Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" })
  });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();
  const instrumentResponse = await fetch(`${api}/api/v1/instruments`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ name: `Synthetic P&L Equity ${suffix}`, instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "USD", ticker: `PNL${String(Date.now()).slice(-6)}`, valuation_source: "MANUAL" })
  });
  assert.equal(instrumentResponse.status, 201);
  const instrument = await instrumentResponse.json();

  const post = async (payload) => {
    const response = await fetch(`${api}/api/v1/ledger/transactions`, {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({
        portfolio_id: portfolio.id, financial_account_id: account.id, source_type: "MANUAL", state: "POSTED", currency_code: "USD", ...payload
      })
    });
    assert.equal(response.status, 201);
    return response.json();
  };
  await post({ activity_type: "BUY", occurred_at: "2026-01-01T10:00:00.000Z", effective_date: "2026-01-01", amount: "100", instrument_id: instrument.id, quantity: "10", unit_price: "10", fee_amount: "2", tax_amount: "1" });
  await post({ activity_type: "SELL", occurred_at: "2026-02-01T10:00:00.000Z", effective_date: "2026-02-01", amount: "60", instrument_id: instrument.id, quantity: "4", unit_price: "15", fee_amount: "1", tax_amount: "1" });

  const query = new URLSearchParams({ portfolio_id: portfolio.id, instrument_id: instrument.id, method: "FIFO", valuation_price: "20", valuation_fx_rate: "0.9", cost_basis_fx_rate: "0.8" });
  const pnlResponse = await fetch(`${api}/api/v1/pnl?${query}`, { headers: auth });
  assert.equal(pnlResponse.status, 200);
  const pnl = await pnlResponse.json();
  assert.equal(pnl.quantity, "6.000000000000");
  assert.equal(pnl.cost_basis, "61.800000000000");
  assert.equal(pnl.realized_pnl_transaction_currency, "16.800000000000");
  assert.equal(pnl.realized_pnl, "15.120000000000");
  assert.equal(pnl.price_pnl, "46.560000000000");
  assert.equal(pnl.fx_pnl, "12.000000000000");
  assert.equal(pnl.unrealized_pnl, "58.560000000000");
  assert.equal(pnl.total_pnl, "73.680000000000");
  assert.equal(pnl.fees, "3.000000000000");
  assert.equal(pnl.taxes, "2.000000000000");
  assert.equal(pnl.calculation_version, "pnl-v1");
});
