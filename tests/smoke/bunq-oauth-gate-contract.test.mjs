import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const contractsSource = readFileSync(new URL("packages/integration-contracts/src/index.ts", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = apiUrl;

test("TC-US-1006: direct bunq OAuth stays behind compliance deployment gate", () => {
  for (const value of ["bunqOAuthDeploymentGateRoute", "/api/v1/bunq-oauth/deployment-gate", "compliance_check", "redirect_uri", "legal_decision", "read_only_permissions", "BUNQ_OAUTH_DISABLED", "bunq-oauth-deployment-gate-v1", "human_approval_required"]) {
    assert.match(apiSource + contractsSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["bunq-oauth-gate", "bunq-oauth-gate-form", "bunq-oauth-gate-status", "bunq-oauth-gate-evidence"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-1006-runtime: gate allows only approved read-only localhost bunq configuration", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const headers = { "content-type": "application/json" };
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `synthetic-bunq-gate-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic bunq gate" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { ...headers, "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const auth = { authorization: `Bearer ${(await login.json()).token}`, ...headers };
  const valid = await fetch(`${api}/api/v1/bunq-oauth/deployment-gate`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "BANK-001", provider: "bunq", scopes: ["accounts:read", "balances:read", "transactions:read"], redirect_uri: "http://localhost:3000/bunq/callback", legal_decision: "APPROVED", read_only_permissions: true }) });
  assert.equal(valid.status, 200);
  const validBody = await valid.json();
  assert.equal(validBody.eligible, true);
  assert.equal(validBody.oauth_status, "NOT_ACTIVATED");
  assert.equal(validBody.human_approval_required, true);
  assert.equal(validBody.calculation_version, "bunq-oauth-deployment-gate-v1");
  assert.equal(validBody.read_only, true);

  const cases = [
    [{ scopes: ["accounts:read", "payments:write"] }, "READ_ONLY_SCOPE_REQUIRED"],
    [{ redirect_uri: "https://evil.example/callback" }, "REDIRECT_URI_NOT_ALLOWED"],
    [{ legal_decision: "PENDING" }, "LEGAL_DECISION_REQUIRED"],
    [{ read_only_permissions: false }, "READ_ONLY_PERMISSION_REQUIRED"]
  ];
  for (const [override, failure] of cases) {
    const response = await fetch(`${api}/api/v1/bunq-oauth/deployment-gate`, { method: "POST", headers: auth, body: JSON.stringify({ fixture: "BANK-001", provider: "bunq", scopes: ["accounts:read", "balances:read", "transactions:read"], redirect_uri: "http://localhost:3000/bunq/callback", legal_decision: "APPROVED", read_only_permissions: true, ...override }) });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.eligible, false);
    assert.ok(body.gate_failures.includes(failure));
    assert.equal(body.oauth_status, "BUNQ_OAUTH_DISABLED");
  }
});
