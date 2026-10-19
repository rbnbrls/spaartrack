const allowedRoles = ["ACCOUNTANT", "ADVISOR"] as const;
const allowedScopes = ["PORTFOLIO_READ", "REPORTS_READ", "ACTIVITIES_READ"] as const;

type ShareRole = typeof allowedRoles[number];
type ShareScope = typeof allowedScopes[number];

export type AccountantShareInput = {
  grantee_email?: unknown;
  role?: unknown;
  scope?: unknown;
  expires_at?: unknown;
};

export function buildAccountantShare(input: AccountantShareInput, nowIso: string): {
  grantee_email: string;
  role: ShareRole;
  scope: ShareScope[];
  expires_at: string;
  status: "ACTIVE";
} {
  const email = typeof input.grantee_email === "string" ? input.grantee_email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INVALID_EMAIL");
  if (!allowedRoles.includes(input.role as ShareRole)) throw new Error("INVALID_ROLE");
  if (!Array.isArray(input.scope) || !input.scope.length || input.scope.some((value) => !allowedScopes.includes(value as ShareScope))) throw new Error("INVALID_SCOPE");
  const expiresAt = typeof input.expires_at === "string" ? input.expires_at : "";
  const expiresTime = Date.parse(expiresAt);
  if (!Number.isFinite(expiresTime)) throw new Error("INVALID_EXPIRY");
  if (expiresTime <= Date.parse(nowIso)) throw new Error("EXPIRY_IN_PAST");
  return { grantee_email: email, role: input.role as ShareRole, scope: [...new Set(input.scope as ShareScope[])], expires_at: new Date(expiresTime).toISOString(), status: "ACTIVE" };
}

export function revokeAccountantShare(share: { id: string; status: string; revoked_at?: string | null; audit_action?: string }, revokedAt: string): typeof share {
  if (share.status !== "ACTIVE") return share;
  return { ...share, status: "REVOKED", revoked_at: revokedAt, audit_action: "REVOKE" };
}
