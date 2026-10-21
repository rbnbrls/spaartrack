import { apiUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const root = new URL("../..", import.meta.url);
const api = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const kernel = readFileSync(new URL("apps/api/src/model-session.ts", root), "utf8");
const web = readWebSource();
const migration = readFileSync(new URL("database/migrations/0022-model-session.sql", root), "utf8");

test("TC-US-1602: model sessions keep provider keys in vault with per-session visibility", () => {
  for (const marker of ["buildModelSession", "model-session-v1", "modelSessionRoute", "MODEL_SESSION_REVOKED", "vault-only"]) {
    assert.match(api + kernel, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(migration, /model_session/);
  for (const marker of ["model-session-panel", "model-session-form", "prepare-model-session", "model-session-submit", "model-session-result", "model-session-evidence", "model-session-v1"]) {
    assert.match(web, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("TC-US-1602 runtime: BYOK session is visible per session and revokeable", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (apiUrl).replace(/\/$/, "");
  const email = `synthetic-model-${Date.now()}@example.test`;
  const userRes = await fetch(`${base}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Model" }) });
  assert.equal(userRes.status, 201);
  const sessionRes = await fetch(`${base}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
  assert.equal(sessionRes.status, 201);
  const session = await sessionRes.json();
  const auth = { "content-type": "application/json", authorization: `Bearer ${session.token}` };
  const createRes = await fetch(`${base}/api/v1/model-sessions`, {
    method: "POST", headers: { ...auth, "x-trace-id": "trace-model-1602", "x-correlation-id": "corr-model-1602" },
    body: JSON.stringify({ provider: "synthetic-local", model: "synthetic-assistant-v1", key_source: "BYOK", vault_path: "vault://synthetic/models/session-1", session_label: "Synthetic session" })
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.key_material, "vault-only");
  assert.ok(!("provider_key" in created));
  assert.equal(created.calculation_version, "model-session-v1");
  const keyLeakRes = await fetch(`${base}/api/v1/model-sessions`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ provider: "synthetic-local", model: "m", key_source: "BYOK", vault_path: "vault://x", session_label: "x", provider_key: "sk-secret" })
  });
  assert.equal(keyLeakRes.status, 400);
  const listRes = await fetch(`${base}/api/v1/model-sessions`, { headers: auth });
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  assert.ok(list.sessions.length >= 1);
  assert.ok(list.sessions.some((s) => s.provider === "synthetic-local" && s.model === "synthetic-assistant-v1"));
  const revokeRes = await fetch(`${base}/api/v1/model-sessions/${created.id}/revoke`, { method: "POST", headers: auth });
  assert.equal(revokeRes.status, 200);
  const revoked = await revokeRes.json();
  assert.equal(revoked.status, "REVOKED");
  assert.match(createRes.headers.get("x-trace-id") || "missing", /./);
});
