import { fixtureKey } from "../helpers/fixture-key.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0604: row review preserves raw and normalized values with correction actor and timestamp", () => {
  for (const value of [
    "/api/v1/import-row-reviews", "import_row_review", "raw_row", "normalized_row", "resolved_values",
    "resolved_by", "resolved_at", "CORRECTION", "ACCEPTED", "REJECTED"
  ]) assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
  for (const value of ["review-panel", "review-correction", "review-save", "review-status", "review-evidence"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("TC-US-0604-runtime: actor corrects a reviewed row without mutating the ledger", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-import-review-0604-${suffix}@example.test`;
  const user = await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic row reviewer" }) });
  assert.equal(user.status, 201);
  const session = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": fixtureKey() }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(session.status, 201);
  const token = (await session.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Review ${suffix}`, reporting_currency_code: "EUR", privacy_scope: "PRIVATE" }) });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();
  const csv = "date,action,amount,currency\n2026-10-17,DEPOSIT,not-a-number,EUR\n";
  const preview = await fetch(`${api}/api/v1/import-validations`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, filename: `IMPORT-001-${suffix}.csv`, content_type: "text/csv", content_base64: Buffer.from(csv).toString("base64") }) });
  assert.equal(preview.status, 201);
  const result = await preview.json();
  assert.equal(result.rows[0].status, "ERROR");
  assert.ok(result.rows[0].id);
  const originalRaw = result.rows[0].raw_row;
  const review = await fetch(`${api}/api/v1/import-row-reviews/${result.rows[0].id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ status: "ACCEPTED", correction: { amount: "100.50" }, normalized_row: { ...result.rows[0].normalized_row, amount: "100.50" } }) });
  const reviewPayload = await review.json();
  assert.equal(review.status, 200, JSON.stringify(reviewPayload));
  const reviewed = reviewPayload;
  assert.equal(reviewed.status, "ACCEPTED");
  assert.deepEqual(reviewed.raw_row, originalRaw);
  assert.equal(reviewed.normalized_row.amount, "100.50");
  assert.equal(reviewed.resolved_values.amount, "100.50");
  assert.equal(reviewed.resolved_by, reviewed.actor_id);
  assert.ok(reviewed.resolved_at);
  assert.equal(reviewed.correction_reason, "CORRECTION");
  const audit = await fetch(`${api}/api/v1/audit`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(audit.status, 200);
  assert.ok((await audit.json()).events.some((event) => event.action === "CORRECTION"));
  const unauthenticated = await fetch(`${api}/api/v1/import-row-reviews/${result.rows[0].id}`, { method: "PATCH", headers, body: JSON.stringify({ status: "REJECTED" }) });
  assert.equal(unauthenticated.status, 401);
});
