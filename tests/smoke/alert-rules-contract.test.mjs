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

test("TC-US-0708: alert rules expose conditions, channels, pause, test and delivery history", () => {
  for (const value of ["/api/v1/alert-rules", "alertRuleRoute", "condition_json", "channels", "is_active", "/test", "delivery_history", "alert_rule", "notification"]) {
    assert.match(apiSource + schemaSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["alerts-panel", "alert-rules-form", "alert-condition", "alert-channel", "alert-pause", "alert-test", "alert-delivery-history"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-0708-runtime: synthetic alert can be created, paused, tested and listed with delivery history", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-alert-0708-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic alert owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const portfolio = await (await fetch(`${api}/api/v1/portfolios`, { method: "POST", headers: auth, body: JSON.stringify({ name: `Alerts ${suffix}`, reporting_currency_code: "EUR", privacy_scope: "PRIVATE" }) })).json();
  const create = await fetch(`${api}/api/v1/alert-rules`, { method: "POST", headers: auth, body: JSON.stringify({ portfolio_id: portfolio.id, name: "Dividend alert", alert_type: "DIVIDEND_EVENT", condition: { event_type: "PAID", minimum_net: "10.00" }, channels: ["IN_APP", "EMAIL"] }) });
  assert.equal(create.status, 201);
  const rule = await create.json();
  assert.deepEqual(rule.channels, ["IN_APP", "EMAIL"]);
  assert.equal(rule.is_active, true);
  const paused = await fetch(`${api}/api/v1/alert-rules/${rule.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ is_active: false }) });
  assert.equal(paused.status, 200);
  assert.equal((await paused.json()).is_active, false);
  const tested = await fetch(`${api}/api/v1/alert-rules/${rule.id}/test`, { method: "POST", headers: auth, body: JSON.stringify({ event: { event_type: "PAID", net: "21.25" } }) });
  assert.equal(tested.status, 201);
  const notification = await tested.json();
  assert.equal(notification.payload.delivery_history[0].status, "TESTED");
  assert.deepEqual(notification.payload.delivery_history[0].channels, ["IN_APP", "EMAIL"]);
  const history = await fetch(`${api}/api/v1/notifications?alert_rule_id=${rule.id}`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(history.status, 200);
  assert.equal((await history.json()).notifications.length, 1);
  assert.equal((await fetch(`${api}/api/v1/alert-rules/${rule.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ is_active: true }) })).status, 200);
  assert.equal((await fetch(`${api}/api/v1/alert-rules/${rule.id}/test`, { method: "POST", headers: auth, body: JSON.stringify({}) })).status, 201);
  assert.equal((await fetch(`${api}/api/v1/notifications?alert_rule_id=${rule.id}`)).status, 401);
});
