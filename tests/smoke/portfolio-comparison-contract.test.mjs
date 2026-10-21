import { fixtureKey } from "../helpers/fixture-key.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/portfolio-comparison.ts", root), "utf8");
const web = readWebSource();
const adr = readFileSync(new URL("docs/adr/0002-canonical-ledger.md", root), "utf8");

test("TC-US-1206: portfolio comparison contract is read-only and period-consistent", () => {
  for (const marker of ["/api/v1/portfolio-comparisons", "portfolioComparisonRoute", "allocation", "performance", "risk", "period_start", "period_end", "free_cash", "COMPARISON_SNAPSHOTS_REQUIRED", "COMPARISON_CURRENCY_MISMATCH", "portfolio-comparison-v1", "trace_id", "correlation_id"]) {
    assert.match(api + kernel, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(adr, /ledger_transaction en ledger_entry zijn de financiële bron van waarheid/);
  for (const marker of ["portfolio-comparison-panel", "portfolio-comparison-form", "comparison-period-start", "comparison-period-end", "comparison-performance", "comparison-risk", "portfolio-comparison-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-1206-runtime: cash-backed portfolios compare allocation, performance and risk side-by-side", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-comparison-1206-${suffix}@example.test`;
  const create = async (path, body, headers = {}) => {
    const response = await fetch(`${process.env.API_URL || "http://localhost:18080"}${path}`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { response, body: await response.json() };
  };

  const user = await create("/api/v1/users", { email, display_name: "Synthetic Comparison 1206" });
  assert.equal(user.response.status, 201);
  const login = await create("/api/v1/test-fixtures/sessions", { email, ttl_seconds: 120 }, { "x-synthetic-fixture-key": fixtureKey() });
  assert.equal(login.response.status, 201);
  const auth = { authorization: `Bearer ${login.body.token}` };
  const portfolioIds = [];

  for (const [name, amount] of [["Synthetic Core 1206", "1000"], ["Synthetic Income 1206", "1200"]]) {
    const portfolio = await create("/api/v1/portfolios", { name, reporting_currency_code: "EUR" }, auth);
    assert.equal(portfolio.response.status, 201);
    const account = await create("/api/v1/accounts", {
      portfolio_id: portfolio.body.id,
      name: `${name} Cash`,
      account_type: "CASH",
      tracking_mode: "BALANCE_ONLY",
      base_currency_code: "EUR",
    }, auth);
    assert.equal(account.response.status, 201);
    const transaction = await create("/api/v1/ledger/transactions", {
      portfolio_id: portfolio.body.id,
      financial_account_id: account.body.id,
      source_type: "MANUAL",
      state: "POSTED",
      currency_code: "EUR",
      activity_type: "DEPOSIT",
      occurred_at: "2026-01-01T10:00:00.000Z",
      effective_date: "2026-01-01",
      amount,
    }, auth);
    assert.equal(transaction.response.status, 201);
    for (const date of ["2026-01-01", "2026-05-01"]) {
      const snapshot = await create("/api/v1/portfolio-snapshots", {
        portfolio_id: portfolio.body.id,
        snapshot_at: `${date}T17:00:00.000Z`,
        calculation_version: `comparison-1206-${suffix}`,
      }, auth);
      assert.equal(snapshot.response.status, 201);
    }
    portfolioIds.push(portfolio.body.id);
  }

  const comparison = await fetch(`${process.env.API_URL || "http://localhost:18080"}/api/v1/portfolio-comparisons?portfolio_ids=${portfolioIds.join(",")}&period_start=2026-01-01&period_end=2026-05-01`, { headers: auth });
  assert.equal(comparison.status, 200);
  const result = await comparison.json();
  assert.equal(result.read_only, true);
  assert.equal(result.source, "portfolio_snapshot + position_snapshot + risk_metric_snapshot");
  assert.deepEqual(result.currencies, ["EUR"]);
  assert.deepEqual(result.portfolios.map((item) => item.allocation.totalPct), [100, 100]);
  assert.deepEqual(result.portfolios.map((item) => item.performance.returnPct), [0, 0]);
  assert.ok(result.trace_id);
  assert.ok(result.correlation_id);
});
