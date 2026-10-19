export type ShareLinkInput = {
  scope?: string;
  exposure_policy?: Record<string, unknown>;
  expires_at?: string | null;
};

export type PortfolioShareLink = {
  access_id: string;
  scope: "RESTRICTED_VIEW" | "VIEW";
  exposure_policy: { hide_amounts: boolean };
  expires_at: string | null;
  status: "ACTIVE" | "EXPIRED";
  calculation_version: "portfolio-share-link-v1";
  source: "portfolio_share_link";
  read_only: true;
};

const SCOPES = ["RESTRICTED_VIEW", "VIEW"];

function randomAccessId(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 64);
  return Array.from(bytes, (b) => alphabet[b]).join("");
}

export function buildPortfolioShareLink(input: ShareLinkInput, nowIso: string): PortfolioShareLink {
  const scope = String(input.scope ?? "").trim().toUpperCase();
  if (!SCOPES.includes(scope)) throw new Error("INVALID_SHARE_LINK");
  const policy = input.exposure_policy && typeof input.exposure_policy === "object" ? input.exposure_policy : {};
  const hideAmounts = policy.hide_amounts === undefined || policy.hide_amounts === null
    ? scope === "RESTRICTED_VIEW"
    : Boolean(policy.hide_amounts);
  if (scope === "RESTRICTED_VIEW" && hideAmounts !== true) throw new Error("INVALID_SHARE_LINK");
  let expiresAt: string | null = null;
  if (input.expires_at !== undefined && input.expires_at !== null && String(input.expires_at).trim() !== "") {
    const parsed = new Date(String(input.expires_at).trim());
    if (Number.isNaN(parsed.getTime())) throw new Error("INVALID_SHARE_LINK");
    expiresAt = parsed.toISOString();
  }
  const now = new Date(nowIso);
  if (Number.isNaN(now.getTime())) throw new Error("INVALID_SHARE_LINK");
  const status = expiresAt !== null && new Date(expiresAt).getTime() <= now.getTime() ? "EXPIRED" : "ACTIVE";
  return {
    access_id: randomAccessId(),
    scope: scope as PortfolioShareLink["scope"],
    exposure_policy: { hide_amounts: hideAmounts },
    expires_at: expiresAt,
    status,
    calculation_version: "portfolio-share-link-v1",
    source: "portfolio_share_link",
    read_only: true
  };
}
