export const addonPermissions = [
  "PORTFOLIO_READ",
  "ACTIVITY_READ",
  "MARKET_DATA_READ",
  "ACTIVITY_PROPOSE",
  "ACTIVITY_MANAGE",
  "SECRET_READ"
] as const;

type AddonPermission = typeof addonPermissions[number];

export type AddonManifest = {
  slug: string;
  name: string;
  version: string;
  permissions: AddonPermission[];
  entrypoints: { ui: string; events: string[] };
  secrets: Array<{ name: string; vault_path: string; key_material: "vault-only" }>;
  assets: Array<{ path: string; content_type: string; sha256: string }>;
  calculation_version: "addon-manifest-v1";
  source: "addon_manifest";
  read_only: false;
};

function invalid(): never { throw new Error("INVALID_ADDON_MANIFEST"); }

export function validateAddonManifest(input: {
  slug?: string; name?: string; version?: string; permissions?: unknown;
  entrypoints?: unknown; secrets?: unknown; assets?: unknown; [key: string]: unknown;
}): AddonManifest {
  const slug = String(input.slug ?? "").trim();
  const name = String(input.name ?? "").trim();
  const version = String(input.version ?? "").trim();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug) || !name || name.length > 120 || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) invalid();
  if (!Array.isArray(input.permissions) || input.permissions.length === 0 || input.permissions.some((permission) => !addonPermissions.includes(String(permission).toUpperCase() as AddonPermission))) invalid();
  const permissions = [...new Set(input.permissions.map((permission) => String(permission).toUpperCase()))] as AddonPermission[];
  const entrypoints = input.entrypoints && typeof input.entrypoints === "object" ? input.entrypoints as { ui?: unknown; events?: unknown } : {};
  const ui = String(entrypoints.ui ?? "").trim();
  const events = Array.isArray(entrypoints.events) ? entrypoints.events.map(String).map((event) => event.trim()).filter(Boolean) : [];
  if (!ui || ui.length > 200 || events.some((event) => !/^[A-Z][A-Z0-9_.-]{1,63}$/.test(event))) invalid();
  const secretsInput = Array.isArray(input.secrets) ? input.secrets : [];
  const secrets = secretsInput.map((raw) => {
    const secret = raw && typeof raw === "object" ? raw as { name?: unknown; vault_path?: unknown; value?: unknown } : {};
    if (secret.value !== undefined || !/^[a-z][a-z0-9_-]{1,63}$/.test(String(secret.name ?? "")) || !/^vault:\/\/[A-Za-z0-9._/-]{1,280}$/.test(String(secret.vault_path ?? ""))) invalid();
    return { name: String(secret.name), vault_path: String(secret.vault_path), key_material: "vault-only" as const };
  });
  const assetsInput = Array.isArray(input.assets) ? input.assets : [];
  const assets = assetsInput.map((raw) => {
    const asset = raw && typeof raw === "object" ? raw as { path?: unknown; content_type?: unknown; sha256?: unknown } : {};
    if (!/^assets\/[A-Za-z0-9._/-]{1,200}$/.test(String(asset.path ?? "")) || !/^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/.test(String(asset.content_type ?? "")) || !/^[a-f0-9]{64}$/i.test(String(asset.sha256 ?? ""))) invalid();
    return { path: String(asset.path), content_type: String(asset.content_type), sha256: String(asset.sha256).toLowerCase() };
  });
  return { slug, name, version, permissions, entrypoints: { ui, events }, secrets, assets, calculation_version: "addon-manifest-v1", source: "addon_manifest", read_only: false };
}

export function buildAddonSandboxPlan(input: { addon_id?: string; permissions?: string[]; assets?: string[]; event_hooks?: string[] }) {
  const addonId = String(input.addon_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(addonId)) throw new Error("INVALID_ADDON_SANDBOX");
  const permissions = [...new Set(input.permissions ?? [])].filter((permission): permission is AddonPermission => addonPermissions.includes(permission as AddonPermission));
  if (!permissions.length) throw new Error("INVALID_ADDON_SANDBOX");
  return {
    addon_id: addonId,
    status: "STOPPED" as const,
    isolation: "addon-sandbox" as const,
    granted_permissions: permissions,
    event_hooks: [...new Set(input.event_hooks ?? [])],
    asset_root: `addon://${addonId}/assets`,
    ledger_access: "none" as const,
    revokable: true as const,
    calculation_version: "addon-sandbox-v1" as const,
    source: "addon_sandbox_run" as const
  };
}
