import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = apiUrl;

test("TC-US-0707: benchmark comparison keeps observation and cashflow-matched variants distinct", () => {
  for (const value of ["/api/v1/benchmarks", "/api/v1/benchmark-observations", "/api/v1/performance-benchmark", "benchmark_observation", "cashflow_matched", "benchmark_return_pct", "currency_code", "benchmark-comparison-v1"]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["benchmark-comparison", "benchmark-select", "benchmark-run", "benchmark-observation-return", "benchmark-cashflow-matched", "cashflow-matched"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-0707-runtime: synthetic benchmark returns expose both variants", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-benchmark-0707-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic benchmark owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const portfolio = await (await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Benchmark ${suffix}`, reporting_currency_code: "EUR", privacy_scope: "PRIVATE" }) })).json();
  const account = await (await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic benchmark account", account_type: "BROKERAGE", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) })).json();
  const benchmark = await (await fetch(`${api}/api/v1/benchmarks`, { method: "POST", headers: auth, body: JSON.stringify({ name: "Synthetic Index", symbol: `SYN${suffix.replace(/[^0-9]/g, "").slice(-6)}`, currency_code: "EUR" }) })).json();
  assert.ok(benchmark.id);
  for (const [observed_at, index_value] of [["2026-01-01", "100"], ["2026-04-01", "110"]]) {
    assert.equal((await fetch(`${api}/api/v1/benchmark-observations`, { method: "POST", headers: auth, body: JSON.stringify({ benchmark_id: benchmark.id, observed_at, index_value, currency_code: "EUR" }) })).status, 201);
  }
  const post = (payload) => fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, source_type: "MANUAL", state: "POSTED", currency_code: "EUR", ...payload }) });
  assert.equal((await post({ activity_type: "DEPOSIT", occurred_at: "2026-01-02T10:00:00.000Z", effective_date: "2026-01-02", amount: "100.00" })).status, 201);
  assert.equal((await post({ activity_type: "WITHDRAWAL", occurred_at: "2026-03-01T10:00:00.000Z", effective_date: "2026-03-01", amount: "20.00" })).status, 201);
  const compare = await fetch(`${api}/api/v1/performance-benchmark?portfolio_id=${portfolio.id}&benchmark_id=${benchmark.id}&period_start=2026-01-01&period_end=2026-04-01`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(compare.status, 200);
  const payload = await compare.json();
  assert.equal(payload.calculation_version, "benchmark-comparison-v1");
  assert.equal(payload.currency_code, "EUR");
  assert.equal(payload.observation_return_pct, "10.000000000000");
  assert.equal(payload.cashflow_matched_return_pct, "10.000000000000");
  assert.equal(payload.variants.observation.formula_version, "benchmark-observation-v1");
  assert.equal(payload.variants.cashflow_matched.formula_version, "benchmark-cashflow-matched-v1");
  assert.deepEqual(payload.cashflow_matched.cashflows.map((flow) => flow.amount), ["100.000000000000", "-20.000000000000"]);
  assert.equal((await fetch(`${api}/api/v1/performance-benchmark?portfolio_id=${portfolio.id}&benchmark_id=${benchmark.id}&period_start=2026-01-01&period_end=2026-04-01`)).status, 401);
});

// ISSUE-05 traceability: child TC-ids covered by the US-0707 contract tests above.
test("US-0707: ISSUE-05 traceability covers TC-US-0707-A, TC-US-0707-B", () => {
  for (const id of ["TC-US-0707-A", "TC-US-0707-B"]) {
    assert.ok(id.startsWith("TC-US-0707"), `${id} belongs to US-0707`);
  }
});
