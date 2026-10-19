export type ModelKeySource = "BYOK" | "LOCAL";

export type ModelSession = {
  provider: string;
  model: string;
  key_source: ModelKeySource;
  key_material: "vault-only";
  vault_path: string;
  session_label: string;
  status: "ACTIVE";
  calculation_version: "model-session-v1";
  source: "model_session";
  read_only: true;
};

export function buildModelSession(input: {
  provider?: string;
  model?: string;
  key_source?: string;
  vault_path?: string;
  session_label?: string;
  provider_key?: unknown;
}): ModelSession {
  if (input.provider_key !== undefined && input.provider_key !== null) throw new Error("INVALID_MODEL_SESSION");
  const provider = String(input.provider ?? "").trim();
  if (!provider || provider.length > 80) throw new Error("INVALID_MODEL_SESSION");
  const model = String(input.model ?? "").trim();
  if (!model || model.length > 80) throw new Error("INVALID_MODEL_SESSION");
  const keySource = String(input.key_source ?? "").trim().toUpperCase();
  if (keySource !== "BYOK" && keySource !== "LOCAL") throw new Error("INVALID_MODEL_SESSION");
  const vaultPath = String(input.vault_path ?? "").trim();
  if (!vaultPath || vaultPath.length > 300 || !vaultPath.startsWith("vault://")) throw new Error("INVALID_MODEL_SESSION");
  const label = String(input.session_label ?? "").trim();
  if (!label || label.length > 120) throw new Error("INVALID_MODEL_SESSION");
  return {
    provider,
    model,
    key_source: keySource as ModelKeySource,
    key_material: "vault-only",
    vault_path: vaultPath,
    session_label: label,
    status: "ACTIVE",
    calculation_version: "model-session-v1",
    source: "model_session",
    read_only: true
  };
}
