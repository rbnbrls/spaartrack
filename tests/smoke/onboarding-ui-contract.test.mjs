import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const html = readFileSync(new URL("apps/web/index.html", root), "utf8");
const fixtureUrl = new URL("fixtures/UI-001.json", root);

test("TC-US-0501: UI-001 onboarding contract leads from empty state to first action", () => {
  assert.equal(existsSync(fixtureUrl), true);
  const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));
  assert.equal(fixture.fixture_id, "UI-001");
  assert.deepEqual(fixture.steps, ["empty", "portfolio", "account", "currency", "first_action"]);
  for (const value of [
    "empty-state", "start-onboarding", "portfolio-form", "account-form", "action-form",
    "reporting_currency_code", "base_currency_code", "/api/v1/users", "/api/v1/sessions",
    "/api/v1/portfolios", "/api/v1/accounts", "/api/v1/ledger/transactions",
    "Onboarding voltooid", "Synthetische lokale demo"
  ]) {
    assert.match(html, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});
