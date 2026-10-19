import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type OfflineCacheEnvelope = {
  scope: "PORTFOLIO_READ";
  portfolio_id: string;
  ciphertext: string;
  iv: string;
  tag: string;
  issued_at: string;
  expires_at: string;
  freshness_seconds: number;
  calculation_version: "offline-cache-v1";
  source: "portfolio_snapshot + position_snapshot";
  read_only: true;
};

function deriveKey(passphrase: string): Buffer {
  if (!passphrase || passphrase.length < 16) throw new Error("INVALID_OFFLINE_CACHE");
  const key = Buffer.alloc(32, 0);
  Buffer.from(passphrase, "utf8").copy(key);
  return key;
}

export function sealOfflineCache(input: {
  scope?: string;
  portfolio_id?: string;
  payload?: unknown;
  ttl_seconds?: number;
  key?: string;
  now?: string;
}): OfflineCacheEnvelope {
  if (input.scope !== "PORTFOLIO_READ") throw new Error("INVALID_OFFLINE_CACHE");
  if (!/^[0-9a-fA-F-]{36}$/.test(String(input.portfolio_id ?? ""))) throw new Error("INVALID_OFFLINE_CACHE");
  const ttl = Number(input.ttl_seconds);
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 604800) throw new Error("INVALID_OFFLINE_CACHE");
  if (input.payload === undefined || input.payload === null || typeof input.payload !== "object") throw new Error("INVALID_OFFLINE_CACHE");
  const key = deriveKey(String(input.key ?? ""));
  const now = new Date(String(input.now ?? new Date().toISOString()));
  if (Number.isNaN(now.getTime())) throw new Error("INVALID_OFFLINE_CACHE");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("offline-cache-v1", "utf8"));
  const plaintext = Buffer.from(JSON.stringify(input.payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const expires = new Date(now.getTime() + ttl * 1000);
  return {
    scope: "PORTFOLIO_READ",
    portfolio_id: String(input.portfolio_id),
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    issued_at: now.toISOString(),
    expires_at: expires.toISOString(),
    freshness_seconds: ttl,
    calculation_version: "offline-cache-v1",
    source: "portfolio_snapshot + position_snapshot",
    read_only: true
  };
}

export function openOfflineCache(input: {
  envelope?: OfflineCacheEnvelope;
  key?: string;
  now?: string;
}): { status: "FRESH" | "STALE" | "EXPIRED"; stale: boolean; write_allowed: false; payload: unknown; freshness_seconds: number } {
  const envelope = input.envelope as OfflineCacheEnvelope;
  if (!envelope || envelope.calculation_version !== "offline-cache-v1" || envelope.scope !== "PORTFOLIO_READ") throw new Error("INVALID_OFFLINE_CACHE");
  const key = deriveKey(String(input.key ?? ""));
  const now = new Date(String(input.now ?? new Date().toISOString()));
  if (Number.isNaN(now.getTime())) throw new Error("INVALID_OFFLINE_CACHE");
  let payload: unknown;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
    decipher.setAAD(Buffer.from("offline-cache-v1", "utf8"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
    payload = JSON.parse(plaintext.toString("utf8"));
  } catch {
    throw new Error("OFFLINE_CACHE_DECRYPT_FAILED");
  }
  const expires = new Date(envelope.expires_at).getTime();
  const issued = new Date(envelope.issued_at).getTime();
  if (!Number.isFinite(expires) || !Number.isFinite(issued)) throw new Error("INVALID_OFFLINE_CACHE");
  const remaining = Math.floor((expires - now.getTime()) / 1000);
  if (remaining < 0) return { status: "EXPIRED", stale: true, write_allowed: false, payload, freshness_seconds: 0 };
  if (remaining < envelope.freshness_seconds / 2) return { status: "STALE", stale: true, write_allowed: false, payload, freshness_seconds: remaining };
  return { status: "FRESH", stale: false, write_allowed: false, payload, freshness_seconds: remaining };
}
