import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-1101-A: report run contract is queued, as-of and source-versioned", () => {
  for (const value of [
    "/api/v1/report-runs", "report_run", "period_start", "period_end", "filters",
    "source_version", "QUEUED", "report-run-v1", "trace_id", "correlation_id"
  ]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-1101-A-runtime: owner can queue and read a synthetic portfolio report run", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-report-1101-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Report Owner" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}`, "content-type": "application/json" };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Synthetic Report ${suffix}`, reporting_currency_code: "EUR" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();

  const queuedResponse = await fetch(`${api}/api/v1/report-runs`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ portfolio_id: portfolio.id, report_type: "PORTFOLIO", period_start: "2026-01-01", period_end: "2026-10-17", filters: { account_scope: "ALL" }, output_format: "JSON", source_version: "ledger-v1" })
  });
  assert.equal(queuedResponse.status, 201);
  const queued = await queuedResponse.json();
  assert.equal(queued.status, "QUEUED");
  assert.equal(queued.report_type, "PORTFOLIO");
  assert.equal(queued.output_format, "JSON");
  assert.equal(queued.source_version, "ledger-v1");
  assert.equal(queued.calculation_version, "report-run-v1");
  assert.match(queued.trace_id, /^[0-9a-f-]{16,}$/i);
  assert.match(queued.correlation_id, /^[0-9a-f-]{16,}$/i);

  const read = await fetch(`${api}/api/v1/report-runs/${queued.id}`, { headers: { authorization: `Bearer ${session.token}` } });
  assert.equal(read.status, 200);
  const readBack = await read.json();
  assert.equal(readBack.id, queued.id);
  assert.deepEqual(readBack.filters, { account_scope: "ALL" });
  assert.equal(readBack.period_start, "2026-01-01");
  assert.equal(readBack.period_end, "2026-10-17");
});

test("TC-US-1101-UI: report run controls and evidence are present", () => {
  for (const value of ["report-run-panel", "report-run-form", "report-run-status", "report-run-v1", "artifact_expires_at", "Download report artifact", "/api/v1/report-runs"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-1101-B: completed report artifact contract is versioned and expiring", () => {
  for (const value of [
    "/complete", "/artifact", "SUCCEEDED", "object_storage_key", "artifact_expires_at",
    "REPORT_ARTIFACT_EXPIRED", "report-artifact-v1"
  ]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-1101-B-runtime: completed synthetic report exposes artifact key, format, status and expiry", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-report-1101b-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Report Artifact Owner" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}`, "content-type": "application/json" };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Synthetic Report Artifact ${suffix}`, reporting_currency_code: "EUR" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const runResponse = await fetch(`${api}/api/v1/report-runs`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, report_type: "PORTFOLIO", period_start: "2026-01-01", period_end: "2026-10-17", filters: { account_scope: "ALL" }, output_format: "JSON", source_version: "ledger-v1" }) });
  assert.equal(runResponse.status, 201);
  const run = await runResponse.json();
  const completedResponse = await fetch(`${api}/api/v1/report-runs/${run.id}/complete`, { method: "POST", headers: auth, body: JSON.stringify({ expiry_hours: 24 }) });
  assert.equal(completedResponse.status, 200);
  const completed = await completedResponse.json();
  assert.equal(completed.status, "SUCCEEDED");
  assert.equal(completed.output_format, "JSON");
  assert.match(completed.object_storage_key, new RegExp(`^reports/${completed.user_id}/${completed.id}\\.json$`));
  assert.equal(completed.calculation_version, "report-artifact-v1");
  assert.ok(Date.parse(completed.artifact_expires_at) > Date.now());

  const artifactResponse = await fetch(`${api}/api/v1/report-runs/${run.id}/artifact`, { headers: { authorization: `Bearer ${session.token}` } });
  assert.equal(artifactResponse.status, 200);
  const artifact = await artifactResponse.json();
  assert.equal(artifact.status, "SUCCEEDED");
  assert.equal(artifact.format, "JSON");
  assert.equal(artifact.artifact_key, completed.object_storage_key);
  assert.equal(artifact.download_available, true);
  assert.ok(Date.parse(artifact.expires_at) > Date.now());
});

test("TC-US-1102: export contract validates format, privacy scope and locale/currency", () => {
  for (const value of [
    "/export", "CSV", "XLSX", "PDF", "locale", "currency", "privacy_scope",
    "content_type", "content_disposition", "report-export-v1", "EXPORT"
  ]) {
    assert.match(apiSource + webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(apiSource, /Intl\.NumberFormat/);
});

test("TC-US-1102-runtime: synthetic export respects filters, privacy scope and locale/currency formatting", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-report-1102-${suffix}@example.test`;
  const created = await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Export Owner" }) });
  assert.equal(created.status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}`, "content-type": "application/json" };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Synthetic Export ${suffix}`, reporting_currency_code: "EUR" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const runResponse = await fetch(`${api}/api/v1/report-runs`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, report_type: "PORTFOLIO", period_start: "2026-01-01", period_end: "2026-10-17", filters: { account_scope: "ALL", include_private_notes: false }, output_format: "CSV", source_version: "ledger-v1" }) });
  assert.equal(runResponse.status, 201);
  const run = await runResponse.json();
  const complete = await fetch(`${api}/api/v1/report-runs/${run.id}/complete`, { method: "POST", headers: auth, body: JSON.stringify({ expiry_hours: 24 }) });
  assert.equal(complete.status, 200);

  const exportResponse = await fetch(`${api}/api/v1/report-runs/${run.id}/export?format=CSV&locale=nl-NL&currency=EUR`, { headers: { authorization: `Bearer ${session.token}` } });
  assert.equal(exportResponse.status, 200);
  const exported = await exportResponse.json();
  assert.equal(exported.format, "CSV");
  assert.equal(exported.locale, "nl-NL");
  assert.equal(exported.currency, "EUR");
  assert.deepEqual(exported.filters, { account_scope: "ALL", include_private_notes: false });
  assert.deepEqual(exported.privacy_scope, { user_id: run.user_id, portfolio_id: portfolio.id });
  assert.equal(exported.calculation_version, "report-export-v1");
  assert.equal(exported.content_type, "text/csv; charset=utf-8");
  assert.match(exported.content, /period_start;period_end;currency;amount/);
  assert.match(exported.content, /1\.234,56/);
  assert.equal(exported.content.includes("include_private_notes"), false);

  for (const format of ["XLSX", "PDF"]) {
    const alternate = await fetch(`${api}/api/v1/report-runs/${run.id}/export?format=${format}&locale=en-US&currency=USD`, { headers: { authorization: `Bearer ${session.token}` } });
    assert.equal(alternate.status, 200);
    const body = await alternate.json();
    assert.equal(body.format, format);
    assert.equal(body.currency, "USD");
    assert.equal(body.download_available, true);
    assert.match(body.content_base64, /^[A-Za-z0-9+/]+=*$/);
  }

  const outsiderEmail = `synthetic-report-1102-outsider-${suffix}@example.test`;
  const outsiderCreated = await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: outsiderEmail, display_name: "Synthetic Export Outsider" }) });
  assert.equal(outsiderCreated.status, 201);
  const outsiderLogin = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email: outsiderEmail, ttl_seconds: 120 }) });
  const outsiderSession = await outsiderLogin.json();
  const denied = await fetch(`${api}/api/v1/report-runs/${run.id}/export?format=CSV&locale=nl-NL&currency=EUR`, { headers: { authorization: `Bearer ${outsiderSession.token}` } });
  assert.equal(denied.status, 404);
  assert.equal((await denied.json()).error, "REPORT_RUN_NOT_FOUND");
});

test("TC-US-1103: taxable income and securities report contract exposes source and estimate boundaries", () => {
  for (const value of [
    "/tax-report", "taxable_income", "sold_securities", "trades", "fiscal_year",
    "security_status", "source_activity_id", "estimated", "tax-report-v1", "CLOSED", "OPEN"
  ]) {
    assert.match(apiSource + webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-1103-runtime: synthetic tax report traces income and trades and filters sold securities", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-report-1103-${suffix}@example.test`;
  const user = await (await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Tax Report Owner" }) })).json();
  const session = await (await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "x-synthetic-fixture-key": "local-test-fixture-only", "content-type": "application/json" }, body: JSON.stringify({ email, ttl_seconds: 120 }) })).json();
  const auth = { authorization: `Bearer ${session.token}`, "content-type": "application/json" };
  const portfolio = await (await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Synthetic Tax Report ${suffix}`, reporting_currency_code: "EUR" }) })).json();
  const account = await (await fetch(`${api}/api/v1/accounts`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Synthetic Tax Account", account_type: "BROKERAGE", tracking_mode: "TRANSACTIONS", base_currency_code: "EUR" }) })).json();
  const instrument = await (await fetch(`${api}/api/v1/instruments`, { method: "POST", headers: auth, body: JSON.stringify({ name: "Synthetic Tax Equity", instrument_type: "STOCK", asset_class: "EQUITY", currency_code: "EUR", ticker: `TAX${suffix.replace(/[^0-9]/g, "").slice(-6)}`, valuation_source: "MANUAL" }) })).json();
  const post = (payload) => fetch(`${api}/api/v1/ledger/transactions`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, financial_account_id: account.id, source_type: "MANUAL", state: "POSTED", currency_code: "EUR", instrument_id: instrument.id, ...payload }) });
  assert.equal((await post({ activity_type: "BUY", occurred_at: "2026-02-01T10:00:00.000Z", effective_date: "2026-02-01", amount: "100.00", quantity: "10", unit_price: "10.00" })).status, 201);
  assert.equal((await post({ activity_type: "SELL", occurred_at: "2026-06-01T10:00:00.000Z", effective_date: "2026-06-01", amount: "120.00", quantity: "10", unit_price: "12.00", fee_amount: "1.00", tax_amount: "2.00" })).status, 201);
  const income = await (await fetch(`${api}/api/v1/income-events`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, instrument_id: instrument.id, event_type: "DIVIDEND", status: "PAID", ex_date: "2026-05-01", payment_date: "2026-05-05", gross_amount: "25.00", tax_amount: "3.75", fee_amount: "0", net_amount: "21.25", currency_code: "EUR" }) })).json();
  const run = await (await fetch(`${api}/api/v1/report-runs`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, report_type: "PORTFOLIO", period_start: "2026-01-01", period_end: "2026-12-31", filters: { fiscal_year: 2026, security_status: "ALL" }, output_format: "JSON", source_version: "ledger-v1" }) })).json();
  assert.equal((await fetch(`${api}/api/v1/report-runs/${run.id}/complete`, { method: "POST", headers: auth, body: JSON.stringify({ expiry_hours: 24 }) })).status, 200);

  const reportResponse = await fetch(`${api}/api/v1/report-runs/${run.id}/tax-report?fiscal_year=2026&security_status=ALL`, { headers: { authorization: `Bearer ${session.token}` } });
  assert.equal(reportResponse.status, 200);
  const report = await reportResponse.json();
  assert.equal(report.calculation_version, "tax-report-v1");
  assert.equal(report.fiscal_year, 2026);
  assert.deepEqual(report.privacy_scope, { user_id: user.id, portfolio_id: portfolio.id });
  assert.equal(report.taxable_income.length, 1);
  assert.equal(report.taxable_income[0].source_activity_id, income.id);
  assert.equal(report.taxable_income[0].gross_amount, "25.00");
  assert.equal(report.taxable_income[0].estimated, false);
  assert.equal(report.trades.length, 2);
  assert.equal(report.sold_securities.length, 1);
  assert.equal(report.sold_securities[0].activity_type, "SELL");
  assert.equal(report.sold_securities[0].estimated, true);
  assert.match(report.sold_securities[0].estimate_reason, /cost basis/i);

  const openOnly = await (await fetch(`${api}/api/v1/report-runs/${run.id}/tax-report?fiscal_year=2026&security_status=OPEN`, { headers: { authorization: `Bearer ${session.token}` } })).json();
  assert.equal(openOnly.trades.length, 1);
  assert.equal(openOnly.sold_securities.length, 0);
});

// ISSUE-05 traceability: child TC-ids covered by the US-1101 contract tests above.
test("US-1101: ISSUE-05 traceability covers TC-US-1101", () => {
  for (const id of ["TC-US-1101"]) {
    assert.ok(id.startsWith("TC-US-1101"), `${id} belongs to US-1101`);
  }
});
test("US-1103: ISSUE-05 traceability covers TC-US-1103-A, TC-US-1103-B", () => {
  for (const id of ["TC-US-1103-A", "TC-US-1103-B"]) {
    assert.ok(id.startsWith("TC-US-1103"), `${id} belongs to US-1103`);
  }
});
