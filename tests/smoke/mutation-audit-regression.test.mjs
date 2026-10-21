import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

const authFor = (token) => ({ authorization: `Bearer ${token}` });

async function createUserAndSession(label, suffix) {
  const email = `synthetic-mutation-audit-${label}-${suffix}@example.test`;
  const userResponse = await fetch(`${api}/api/v1/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: `Synthetic Mutation Audit ${label}` })
  });
  assert.equal(userResponse.status, 201);
  const user = await userResponse.json();
  const sessionResponse = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" },
    body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(sessionResponse.status, 201);
  const session = await sessionResponse.json();
  return { user, auth: authFor(session.token) };
}

async function auditEvents(auth) {
  const response = await fetch(`${api}/api/v1/audit`, { headers: auth });
  assert.equal(response.status, 200);
  return (await response.json()).events;
}

test("TC-US-0205 regression: mutation handlers identify auditable entities", () => {
  for (const marker of [
    '["CREATE", "FINANCIAL_ACCOUNT"]',
    '["UPDATE", "PORTFOLIO"]',
    '["CREATE", "LEDGER_TRANSACTION"]',
    '["CREATE", "FX_RATE"]',
    '["CREATE", "INSTRUMENT_PRICE"]',
    '["UPDATE", "INSTRUMENT_MAPPING"]',
    '["CREATE", "INSTRUMENT_MAPPING"]',
    '["CREATE", "INSTRUMENT"]',
    '["CREATE", "CORPORATE_ACTION"]',
    '["CREATE", "BENCHMARK"]',
    '["CREATE", "BENCHMARK_OBSERVATION"]',
    '["REVOKE", "EXTERNAL_CONNECTION"]',
    '["CREATE", "EXTERNAL_CONNECTION"]',
    '["CREATE", "PROVIDER"]',
    '["UPDATE", "PROVIDER"]',
    '["CREATE", "NOTIFICATION"]',
    '["UPDATE", "ALERT_RULE"]',
    '["CREATE", "ALERT_RULE"]'
  ]) {
    const [action, entityType] = JSON.parse(marker);
    assert.match(apiSource, new RegExp(`auditEvent\\(req, res, userId, "${action}", "${entityType}"`));
  }
});

test("TC-US-0205 runtime: ledger, account and portfolio mutations have correlated audit rows", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const { user, auth } = await createUserAndSession("owner", suffix);
  const trace = `trace-mutation-audit-${suffix}`;
  const correlation = `corr-mutation-audit-${suffix}`;
  const tracedHeaders = { ...auth, "content-type": "application/json", "x-trace-id": trace, "x-correlation-id": correlation };

  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST", headers: tracedHeaders,
    body: JSON.stringify({ name: "Synthetic Mutation Audit Portfolio", reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();

  const accountResponse = await fetch(`${api}/api/v1/accounts`, {
    method: "POST", headers: tracedHeaders,
    body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic Audit Cash", account_type: "CASH", tracking_mode: "BALANCE_ONLY", status: "ACTIVE", base_currency_code: "EUR" })
  });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();

  const renamed = await fetch(`${api}/api/v1/portfolios/${portfolio.id}`, {
    method: "PATCH", headers: tracedHeaders,
    body: JSON.stringify({ name: "Synthetic Mutation Audit Portfolio Renamed" })
  });
  assert.equal(renamed.status, 200);

  const transactionResponse = await fetch(`${api}/api/v1/ledger/transactions`, {
    method: "POST", headers: tracedHeaders,
    body: JSON.stringify({
      portfolio_id: portfolio.id, financial_account_id: account.id, activity_type: "DEPOSIT",
      occurred_at: "2026-10-21T09:00:00.000Z", effective_date: "2026-10-21", amount: "125",
      currency_code: "EUR", source_type: "MANUAL", state: "POSTED"
    })
  });
  assert.equal(transactionResponse.status, 201);
  const transaction = await transactionResponse.json();

  const events = await auditEvents(auth);
  const expected = [
    ["CREATE", "FINANCIAL_ACCOUNT", account.id],
    ["UPDATE", "PORTFOLIO", portfolio.id],
    ["CREATE", "LEDGER_TRANSACTION", transaction.id]
  ];
  for (const [action, entityType, entityId] of expected) {
    const event = events.find((candidate) => candidate.action === action && candidate.entity_type === entityType && candidate.entity_id === entityId);
    assert.ok(event, `missing ${action} ${entityType} audit event for ${entityId}`);
    assert.equal(event.actor_type, "USER");
    assert.equal(event.actor_id, user.id);
    assert.equal(event.trace_id, trace);
    assert.equal(event.correlation_id, correlation);
  }
  assert.equal(transaction.id, expected[2][2], "ledger response and audit entity use the same canonical transaction id");
});

test("TC-US-0205 runtime: rejected ledger input does not create an orphan audit event", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const { auth } = await createUserAndSession("invalid", suffix);
  const before = await auditEvents(auth);
  const response = await fetch(`${api}/api/v1/ledger/transactions`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json", "x-trace-id": `trace-invalid-${suffix}`, "x-correlation-id": `corr-invalid-${suffix}` },
    body: JSON.stringify({ activity_type: "DEPOSIT", amount: "not-a-number", currency_code: "EUR" })
  });
  assert.equal(response.status, 400);
  const after = await auditEvents(auth);
  assert.deepEqual(after.map((event) => event.id), before.map((event) => event.id));
});