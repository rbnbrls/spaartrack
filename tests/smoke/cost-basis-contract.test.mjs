import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const adrSource = readFileSync(new URL("docs/adr/0002-canonical-ledger.md", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0404: cost basis contract exposes FIFO/WAC, fees, taxes and partial sells", () => {
  for (const value of [
    "/api/v1/cost-basis", "FIFO", "WAC", "tax_lot", "tax_lot_disposal", "fee_amount",
    "tax_amount", "realized_gain", "cost_basis", "calculation_version"
  ]) {
    assert.match(apiSource + schemaSource + adrSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(schemaSource, /CREATE TABLE tax_lot/);
  assert.match(schemaSource, /CREATE TABLE tax_lot_disposal/);
  assert.match(adrSource, /ledger_transaction en ledger_entry zijn de financiële bron van waarheid/);
});

test("TC-US-0404-runtime: FIFO and WAC golden cases include fees/taxes and partial sell allocation", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-cost-basis-0404-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic Cost Basis" })
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
    body: JSON.stringify({ name: `Synthetic Cost Basis ${suffix}`, reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const accountResponse = await fetch(`${api}/api/v1/accounts`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" })
  });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();
  const instrumentResponse = await fetch(`${api}/api/v1/instruments`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ name: `Synthetic Cost Basis Equity ${suffix}`, instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `CB${String(Date.now()).slice(-6)}`, valuation_source: "MANUAL" })
  });
  assert.equal(instrumentResponse.status, 201);
  const instrument = await instrumentResponse.json();

  const post = async (payload) => {
    const response = await fetch(`${api}/api/v1/ledger/transactions`, {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({
        portfolio_id: portfolio.id, financial_account_id: account.id, source_type: "MANUAL", state: "POSTED", currency_code: "EUR", ...payload
      })
    });
    assert.equal(response.status, 201);
    return response.json();
  };
  await post({ activity_type: "BUY", occurred_at: "2026-01-01T10:00:00.000Z", effective_date: "2026-01-01", amount: "100", instrument_id: instrument.id, quantity: "10", unit_price: "10", fee_amount: "2", tax_amount: "1", description: "Synthetic first lot" });
  await post({ activity_type: "BUY", occurred_at: "2026-02-01T10:00:00.000Z", effective_date: "2026-02-01", amount: "70", instrument_id: instrument.id, quantity: "5", unit_price: "14", fee_amount: "1", description: "Synthetic second lot" });
  await post({ activity_type: "SELL", occurred_at: "2026-03-01T10:00:00.000Z", effective_date: "2026-03-01", amount: "240", instrument_id: instrument.id, quantity: "12", unit_price: "20", fee_amount: "3", tax_amount: "4", description: "Synthetic partial sell" });

  const readBasis = async (method) => {
    const response = await fetch(`${api}/api/v1/cost-basis?portfolio_id=${portfolio.id}&instrument_id=${instrument.id}&method=${method}`, { headers: auth });
    assert.equal(response.status, 200);
    return response.json();
  };
  const fifo = await readBasis("FIFO");
  assert.equal(fifo.method, "FIFO");
  assert.equal(fifo.quantity, "3.000000000000");
  assert.equal(fifo.cost_basis, "42.600000000000");
  assert.equal(fifo.realized_gain, "101.600000000000");
  assert.equal(fifo.fees, "6.000000000000");
  assert.equal(fifo.taxes, "5.000000000000");
  assert.equal(fifo.lots.length, 1);
  assert.equal(fifo.lots[0].remaining_quantity, "3.000000000000");

  const wac = await readBasis("WAC");
  assert.equal(wac.method, "WAC");
  assert.equal(wac.quantity, "3.000000000000");
  assert.equal(wac.cost_basis, "34.800000000000");
  assert.equal(wac.realized_gain, "93.800000000000");
  assert.equal(wac.calculation_version, "cost-basis-v1");

  const invalid = await fetch(`${api}/api/v1/cost-basis?portfolio_id=${portfolio.id}&instrument_id=${instrument.id}&method=LIFO`, { headers: auth });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error, "INVALID_COST_BASIS_METHOD");
});
