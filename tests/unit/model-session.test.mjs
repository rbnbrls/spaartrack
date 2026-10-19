import test from "node:test";
import assert from "node:assert/strict";
import { buildModelSession } from "../../apps/api/src/model-session.ts";

test("TC-US-1602: BYOK/local model session keeps provider key in vault and is revokeable", () => {
  const session = buildModelSession({
    provider: "synthetic-local",
    model: "synthetic-assistant-v1",
    key_source: "BYOK",
    vault_path: "vault://synthetic/models/session-1",
    session_label: "Synthetic session"
  });
  assert.equal(session.provider, "synthetic-local");
  assert.equal(session.model, "synthetic-assistant-v1");
  assert.equal(session.key_material, "vault-only");
  assert.equal(session.vault_path, "vault://synthetic/models/session-1");
  assert.equal(session.status, "ACTIVE");
  assert.equal(session.calculation_version, "model-session-v1");
  assert.equal(session.read_only, true);
  assert.ok(!("provider_key" in session));
});

test("TC-US-1602: invalid provider key material and revoke are rejected", () => {
  assert.throws(() => buildModelSession({
    provider: "synthetic-local", model: "m", key_source: "BYOK",
    vault_path: "", session_label: "x"
  }), /INVALID_MODEL_SESSION/);
  assert.throws(() => buildModelSession({
    provider: "synthetic-local", model: "m", key_source: "BYOK",
    vault_path: "vault://x", session_label: "x", provider_key: "sk-secret"
  }), /INVALID_MODEL_SESSION/);
  assert.throws(() => buildModelSession({
    provider: "", model: "m", key_source: "LOCAL",
    vault_path: "vault://x", session_label: "x"
  }), /INVALID_MODEL_SESSION/);
});
