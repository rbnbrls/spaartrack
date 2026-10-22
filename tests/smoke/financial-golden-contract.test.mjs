import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const fixtureUrl = new URL("fixtures/CALC-001.json", root);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const replaySource = readFileSync(new URL("tests/smoke/ledger-replay-contract.test.mjs", root), "utf8");
const backupSource = readFileSync(new URL("infra/backup/backup-local.sh", root), "utf8");
const restoreSource = readFileSync(new URL("infra/backup/restore-local.sh", root), "utf8");
const api = apiUrl;

test("TC-US-0408: CALC-001 golden fixture covers the financial kernel contract", () => {
  assert.equal(existsSync(fixtureUrl), true);
  const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));
  assert.equal(fixture.fixture_id, "CALC-001");
  assert.deepEqual(fixture.coverage.sort(), ["dividend_tax", "fees", "multi_currency", "restore_replay", "split", "transfer"]);
  for (const value of [
    "/api/v1/fx/rates", "/api/v1/ledger/transactions", "/api/v1/corporate-actions", "/api/v1/cost-basis",
    "/api/v1/pnl", "/api/v1/ledger/replay", "fee_amount", "tax_amount", "paired_transaction_id",
    "replay_hash", "portfolio_snapshot", "pg_restore", "openssl enc"
  ]) {
    assert.match(apiSource + schemaSource + replaySource + backupSource + restoreSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-0408-runtime: CALC-001 is deterministic across FX, dividend tax, fees, transfer, split and replay", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-calc-0408-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic CALC-001" })
  });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" },
    body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };
  const jsonRequest = async (path, method, body) => {
    const response = await fetch(`${api}${path}`, {
      method, headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body)
    });
    const payload = await response.json();
    return { response, payload };
  };
  const portfolioResult = await jsonRequest("/api/v1/portfolios", "POST", { name: `Synthetic CALC-001 ${suffix}`, reporting_currency_code: fixture.reporting_currency_code });
  assert.equal(portfolioResult.response.status, 201);
  const portfolio = portfolioResult.payload;
  const accountResult = await jsonRequest("/api/v1/accounts", "POST", { portfolio_id: portfolio.id, name: "Synthetic CALC-001 Brokerage", account_type: "BROKERAGE", tracking_mode: "HOLDINGS", base_currency_code: "EUR" });
  assert.equal(accountResult.response.status, 201);
  const account = accountResult.payload;
  const destinationResult = await jsonRequest("/api/v1/accounts", "POST", { portfolio_id: portfolio.id, name: "Synthetic CALC-001 Cash", account_type: "CASH", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" });
  assert.equal(destinationResult.response.status, 201);
  const destination = destinationResult.payload;
  const instrumentResult = await jsonRequest("/api/v1/instruments", "POST", { name: `Synthetic CALC-001 Equity ${suffix}`, instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "USD", ticker: `C4${String(Date.now()).slice(-5)}`, valuation_source: "MANUAL" });
  assert.equal(instrumentResult.response.status, 201);
  const instrument = instrumentResult.payload;

  const fxResult = await jsonRequest("/api/v1/fx/rates", "POST", { ...fixture.fx_rate, source: `${fixture.fx_rate.source}-${suffix}`, rate_at: `${fixture.as_of}T10:00:00.000Z` });
  assert.equal(fxResult.response.status, 201);
  assert.equal(fxResult.payload.source_version, fixture.fx_rate.source_version);

  const book = async (transaction) => {
    const requestBody = {
      portfolio_id: portfolio.id, financial_account_id: account.id, source_type: "MANUAL", state: "POSTED",
      instrument_id: transaction.instrument_id ? instrument.id : undefined, ...transaction
    };
    const result = await jsonRequest("/api/v1/ledger/transactions", "POST", {
      ...requestBody
    });
    assert.equal(result.response.status, 201, `${JSON.stringify(requestBody)} => ${JSON.stringify(result.payload)}`);
    return result.payload;
  };
  await book({ ...fixture.transactions.deposit, external_id: `calc-${suffix}-deposit` });
  const transfer = await book({ ...fixture.transactions.transfer, destination_financial_account_id: destination.id, external_id: `calc-${suffix}-transfer` });
  assert.equal(transfer.paired_transaction.paired_transaction_id, transfer.id);
  await book({ ...fixture.transactions.buy, instrument_id: instrument.id, external_id: `calc-${suffix}-buy` });
  const dividend = await book({ ...fixture.transactions.dividend, instrument_id: instrument.id, external_id: `calc-${suffix}-dividend` });
  assert.equal(dividend.entries[0].tax_amount, Number(fixture.transactions.dividend.tax_amount).toFixed(12));
  assert.equal(dividend.entries[0].fee_amount, Number(fixture.transactions.dividend.fee_amount).toFixed(12));
  const action = await jsonRequest("/api/v1/corporate-actions", "POST", { ...fixture.split, instrument_id: instrument.id });
  assert.equal(action.response.status, 201);
  await book({ ...fixture.transactions.sell, instrument_id: instrument.id, external_id: `calc-${suffix}-sell` });

  const basisResult = await fetch(`${api}/api/v1/cost-basis?portfolio_id=${portfolio.id}&instrument_id=${instrument.id}&method=FIFO`, { headers: auth });
  assert.equal(basisResult.status, 200);
  const basis = await basisResult.json();
  assert.equal(basis.quantity, fixture.expected.cost_basis.quantity);
  assert.equal(basis.cost_basis, fixture.expected.cost_basis.cost_basis);
  assert.equal(basis.fees, fixture.expected.cost_basis.fees);
  assert.equal(basis.taxes, fixture.expected.cost_basis.taxes);

  const pnlResult = await fetch(`${api}/api/v1/pnl?portfolio_id=${portfolio.id}&instrument_id=${instrument.id}&method=FIFO&valuation_price=${fixture.expected.pnl.valuation_price}&valuation_fx_rate=${fixture.expected.pnl.valuation_fx_rate}&cost_basis_fx_rate=${fixture.expected.pnl.cost_basis_fx_rate}`, { headers: auth });
  assert.equal(pnlResult.status, 200);
  const pnl = await pnlResult.json();
  assert.equal(pnl.quantity, fixture.expected.pnl.quantity);
  assert.equal(pnl.unrealized_pnl, fixture.expected.pnl.unrealized_pnl);
  assert.equal(pnl.fees, fixture.expected.pnl.fees);
  assert.equal(pnl.taxes, fixture.expected.pnl.taxes);

  const replay = async () => jsonRequest("/api/v1/ledger/replay", "POST", { portfolio_id: portfolio.id });
  const firstReplay = await replay();
  assert.equal(firstReplay.response.status, 200);
  const secondReplay = await replay();
  assert.equal(secondReplay.response.status, 200);
  assert.equal(secondReplay.payload.replay_hash, firstReplay.payload.replay_hash);
  assert.equal(secondReplay.payload.calculation_version, "ledger-replay-v1");
});
