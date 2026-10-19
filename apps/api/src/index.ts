import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createConnection } from "node:net";
import { Pool } from "pg";
import { calculateShareWeightedBalance, validateGoalFundingAllocations } from "./goal-funding.js";
import { buildCashflowForecast } from "./forecast.js";
import { buildAccountantShare } from "./accountant-access.js";
import { calculateRiskMetrics } from "./risk-metrics.js";
import { calculateRiskContributions } from "./risk-contribution.js";
import { calculateEtfExposure } from "./etf-exposure.js";
import { validateAllocationTargets } from "./allocation-targets.js";
import { calculateDriftRebalance } from "./drift-rebalance.js";
import { comparePortfolios } from "./portfolio-comparison.js";
import { runWhatIfBacktest } from "./what-if-backtest.js";
import { buildScreenerDefinition } from "./screener-watchlist.js";
import { buildTaxLots, calculateRealizedGains, compareTaxLotMethods, type TaxLotMethod } from "./tax-lots.js";
import { buildFiscalYearReport } from "./fiscal-year-report.js";
import { buildTaxLossHarvestingCandidates } from "./tax-loss-harvesting.js";
import { detectWashSaleRisks } from "./wash-sale.js";
import { buildTaxWorksheet } from "./tax-worksheet.js";
import { generateBondCashflows, validateBondProfile, type BondProfileInput, type BondCashflowEntry } from "./bond-profile.js";
import { calculateBondMetrics } from "./bond-pricing.js";
import { buildBondCurveScenario } from "./bond-curve-scenario.js";
import { validateOptionContract, deriveOptionLifecycleStatus, type OptionLifecycleEventInput } from "./option-contract.js";
import { calculateOptionGreeks } from "./option-greeks.js";
import { planOptionLifecycleEvent, summarizeOptionPosition } from "./option-lifecycle.js";
import { planWheelCycle } from "./wheel-strategy.js";
import { describeAlternativeAssetValuation } from "./alternative-assets.js";
import { planFireScenario } from "./fire-scenarios.js";
import { buildPortfolioShareLink } from "./portfolio-share-links.js";
import { projectRestrictedView } from "./restricted-view.js";
import { validatePushConsent, recordPushDelivery } from "./push-consent.js";
import { buildAssistantAnswer } from "./assistant-answer.js";
import { buildAssistantProposal, decideAssistantProposal } from "./assistant-proposal.js";
import { buildModelSession } from "./model-session.js";
import { buildAgentScopeMatrix } from "./agent-scopes.js";
import { validateAddonManifest, buildAddonSandboxPlan } from "./addon-sandbox.js";
import { buildAddonSdkRead, validateAddonEventHook } from "./addon-sdk.js";
import { buildCommunityExport, buildCommunityPost } from "./community-feed.js";
import { buildIncidentAlert, incidentFingerprint, severityRank } from "./incident-routing.js";
import { buildIncidentEvidenceBundle, type IncidentEvidenceInput } from "./incident-evidence.js";
import { buildIncidentHypothesis, type IncidentHypothesisInput } from "./incident-diagnosis.js";
import { buildFixVerification } from "./incident-fix-verification.js";
import { buildVerifierReview } from "./incident-verifier.js";
import { buildPromotionGate } from "./incident-promotion.js";
import { buildRollbackGate } from "./incident-rollback.js";
import { buildIncidentClosure } from "./incident-closure.js";
import { buildSkillProposal } from "./incident-skill-proposal.js";

const port = Number(process.env.PORT || 8080);
const release = process.env.APP_RELEASE || "local";
const environment = process.env.APP_ENV || "local";
const startedAt = new Date().toISOString();
const commitSha = process.env.APP_COMMIT_SHA || process.env.COOLIFY_COMMIT_SHA || "local";
const imageDigest = process.env.APP_IMAGE_DIGEST || process.env.COOLIFY_IMAGE_DIGEST || "local";
const migrationVersion = process.env.APP_MIGRATION_VERSION || process.env.COOLIFY_MIGRATION_VERSION || "schema.sql";
const deployedAt = process.env.APP_DEPLOYED_AT || startedAt;
const databasePool = new Pool({ connectionString: process.env.DATABASE_URL });
const userStatuses = ["ACTIVE", "INVITED", "SUSPENDED", "DELETED"] as const;
const portfolioRoles = ["OWNER", "EDITOR", "VIEWER", "ACCOUNTANT", "ADVISOR"] as const;
const accountTypes = ["BROKERAGE", "BANK", "CASH", "CREDIT_CARD", "LOAN", "CRYPTO", "PROPERTY", "CUSTOM"] as const;
const trackingModes = ["TRANSACTIONS", "HOLDINGS", "BALANCE_ONLY"] as const;
const accountStatuses = ["ACTIVE", "HIDDEN", "ARCHIVED"] as const;
const instrumentTypes = ["STOCK", "ETF", "FUND", "BOND", "OPTION", "CRYPTO", "PRECIOUS_METAL", "FUTURE", "MONEY_MARKET", "PROPERTY", "VEHICLE", "COLLECTIBLE", "CUSTOM", "CASH"] as const;
const assetClasses = ["EQUITY", "FIXED_INCOME", "DERIVATIVE", "CRYPTO", "CASH", "REAL_ASSET", "LIABILITY", "OTHER"] as const;
const valuationSources = ["MARKET_DATA", "MANUAL", "PROVIDER", "NONE"] as const;
const activityTypes = ["BUY", "SELL", "DIVIDEND", "INTEREST", "DEPOSIT", "WITHDRAWAL", "TRANSFER_IN", "TRANSFER_OUT", "CREDIT", "FEE", "TAX", "SPLIT", "FX_CONVERSION", "RETURN_OF_CAPITAL", "DIVIDEND_IN_KIND", "STAKING_REWARD", "BONUS", "REBATE", "REFUND", "CORRECTION", "LIABILITY_PAYMENT", "OTHER"] as const;
const transactionStates = ["POSTED", "PENDING", "DRAFT", "VOID"] as const;
const sourceTypes = ["MANUAL", "IMPORT", "PROVIDER_API", "WEBHOOK", "SYSTEM", "AI_PROPOSAL"] as const;
const importDuplicateReasonCodes = ["IMPORT_DUPLICATE_PROVIDER_ID", "IMPORT_DUPLICATE_PROVIDER_HASH"] as const;
const reconciliationIssueTypes = ["UNKNOWN_INSTRUMENT", "DUPLICATE", "BALANCE_MISMATCH", "MISSING_ACTIVITY", "UNMAPPED_FIELD", "AMBIGUOUS_TRANSFER", "SCHEMA_ERROR", "OTHER"] as const;
const reconciliationSeverities = ["INFO", "WARNING", "ERROR", "BLOCKING"] as const;
const reconciliationStatuses = ["OPEN", "IN_REVIEW", "RESOLVED", "IGNORED"] as const;
const incomeEventStatuses = ["ANNOUNCED", "PROJECTED", "EX_DATE", "PAID", "CANCELLED"] as const;
const incomeEventTypes = ["DIVIDEND", "INTEREST", "COUPON", "OPTION_PREMIUM", "STAKING", "OTHER"] as const;
const incomeExpectedStatuses = ["ANNOUNCED", "PROJECTED", "EX_DATE"] as const;
const syntheticBankInstitutions = [
  { institution_id: "synthetic-nl-bank", provider_slug: "gocardless", name: "Synthetic Netherlands Bank", region: "NL", country_code: "NL", capabilities: ["ACCOUNTS", "BALANCES", "TRANSACTIONS"], availability: { status: "AVAILABLE", checked_at: "2026-10-17T00:00:00.000Z", message: "Synthetic BANK-001 institution available for local testing." } },
  { institution_id: "synthetic-de-bank", provider_slug: "gocardless", name: "Synthetic Deutschland Bank", region: "DE", country_code: "DE", capabilities: ["ACCOUNTS", "BALANCES"], availability: { status: "DEGRADED", checked_at: "2026-10-17T00:00:00.000Z", message: "Synthetic BANK-001 transactions temporarily unavailable." } },
  { institution_id: "synthetic-be-bank", provider_slug: "gocardless", name: "Synthetic Belgium Bank", region: "BE", country_code: "BE", capabilities: ["ACCOUNTS", "BALANCES", "TRANSACTIONS"], availability: { status: "UNAVAILABLE", checked_at: "2026-10-17T00:00:00.000Z", message: "Synthetic BANK-001 institution is unavailable." } }
] as const;
const syntheticBankAccounts = [
  { id: "synthetic-nl-current", institution_id: "synthetic-nl-bank", account_type: "CURRENT", name: "Synthetic Current Account", base_currency_code: "EUR", currency_code: "EUR", provider_account_id: "bank-001-current" },
  { id: "synthetic-nl-savings", institution_id: "synthetic-nl-bank", account_type: "SAVINGS", name: "Synthetic Savings Account", base_currency_code: "EUR", currency_code: "EUR", provider_account_id: "bank-001-savings" },
  { id: "synthetic-nl-card", institution_id: "synthetic-nl-bank", account_type: "CREDIT_CARD", name: "Synthetic Credit Card", base_currency_code: "EUR", currency_code: "EUR", provider_account_id: "bank-001-card" }
] as const;
type PortfolioRole = typeof portfolioRoles[number];
type UserStatus = typeof userStatuses[number];

type TracedResponse = ServerResponse & {
  trace_id?: string;
  correlation_id?: string;
};

function redactedLog(fields: Record<string, unknown>): string {
  return JSON.stringify(fields)
    .replace(/("(?:token|secret|api_key|api-key|account_number|account-number|transaction_description|transaction-description|description)"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
    .replace(/(token|secret|api_key|api-key|account_number|account-number)=?[^,}" ]+/gi, "$1=[REDACTED]");
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-trace-id,x-correlation-id"
  });
  const traced = res as TracedResponse;
  const payload = body as Record<string, unknown>;
  res.end(JSON.stringify({
    ...payload,
    trace_id: traced.trace_id,
    correlation_id: traced.correlation_id,
    service: "api",
    ...(payload.release === undefined ? { release } : {})
  }));
}

function correlationId(req: IncomingMessage): string {
  return req.headers["x-correlation-id"]?.toString() || randomUUID();
}

function traceId(req: IncomingMessage): string {
  return req.headers["x-trace-id"]?.toString() || randomUUID();
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
      if (raw.length > 32_768) reject(new Error("request_too_large"));
    });
    req.on("end", () => {
      try {
        const body = raw ? JSON.parse(raw) : {};
        resolve(body && typeof body === "object" ? body as Record<string, unknown> : {});
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function userResponse(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    status: row.status,
    locale: row.locale,
    timezone: row.timezone,
    default_currency_code: row.default_currency_code,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at
  };
}

function sessionHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function authorizationToken(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization?.toString() || "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : undefined;
}

function sessionResponse(row: Record<string, unknown>): Record<string, unknown> {
  return { user_id: row.user_id, expires_at: row.expires_at };
}

async function createSessionForUser(userId: string, ttlSeconds = 3600): Promise<{ token: string; expiresAt: unknown }> {
  const token = randomBytes(32).toString("base64url");
  const result = await databasePool.query(
    `INSERT INTO spaartrack.user_session (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 * interval '1 second'))
     RETURNING expires_at`,
    [userId, sessionHash(token), ttlSeconds]
  );
  return { token, expiresAt: result.rows[0].expires_at };
}

async function auditEvent(
  req: IncomingMessage,
  res: ServerResponse,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  after?: Record<string, unknown>
): Promise<void> {
  const traced = res as TracedResponse;
  await databasePool.query(
    `INSERT INTO spaartrack.audit_log
       (user_id, actor_type, actor_id, action, entity_type, entity_id, after_json, correlation_id, trace_id)
     VALUES ($1, 'USER', $2, $3, $4, $5, $6, $7, $8)`,
    [
      actorId,
      actorId,
      action,
      entityType,
      entityId,
      after ? JSON.stringify(after) : null,
      traced.correlation_id || req.headers["x-correlation-id"]?.toString() || null,
      traced.trace_id || req.headers["x-trace-id"]?.toString() || null
    ]
  );
}

function totpKey(): Buffer {
  return createHash("sha256").update(process.env.TOTP_ENCRYPTION_KEY || "synthetic-local-totp-encryption-key").digest();
}

function base32Encode(value: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of value) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) output += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  return output.padEnd(Math.ceil(output.length / 8) * 8, "=");
}

function encryptTotpSecret(secret: string): { ciphertext: string; iv: string; tag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", totpKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64url"), iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") };
}

function decryptTotpSecret(row: Record<string, unknown>): string {
  const decipher = createDecipheriv("aes-256-gcm", totpKey(), Buffer.from(String(row.secret_iv), "base64url"));
  decipher.setAuthTag(Buffer.from(String(row.secret_tag), "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(String(row.secret_ciphertext), "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function totpCode(secret: string, timestamp = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of secret.replace(/=+$/, "")) bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  const key = Buffer.from((bits.match(/.{8}/g) || []).map((chunk) => Number.parseInt(chunk, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 1000 / 30)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

async function authenticatedUserId(req: IncomingMessage): Promise<string | undefined> {
  const token = authorizationToken(req);
  if (!token) return undefined;
  const result = await databasePool.query(
    `SELECT s.user_id FROM spaartrack.user_session s
     JOIN spaartrack.app_user u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
       AND u.status = 'ACTIVE' AND u.deleted_at IS NULL`,
    [sessionHash(token)]
  );
  return result.rowCount ? String(result.rows[0].user_id) : undefined;
}

async function totpRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }
  if (req.method === "POST" && req.url === "/api/v1/2fa/totp") {
    const secret = base32Encode(randomBytes(20));
    const encrypted = encryptTotpSecret(secret);
    const result = await databasePool.query(
      `INSERT INTO spaartrack.user_totp_factor (user_id, secret_ciphertext, secret_iv, secret_tag)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET secret_ciphertext = EXCLUDED.secret_ciphertext,
         secret_iv = EXCLUDED.secret_iv, secret_tag = EXCLUDED.secret_tag, revoked_at = NULL
       RETURNING id`,
      [userId, encrypted.ciphertext, encrypted.iv, encrypted.tag]
    );
    await auditEvent(req, res, userId, "SECRET_ACCESS", "TOTP_FACTOR", String(result.rows[0].id), { operation: "enroll" });
    json(res, 201, { factor_id: result.rows[0].id, user_id: userId, secret, algorithm: "SHA1", period_seconds: 30, digits: 6 });
    return true;
  }
  if (req.method === "POST" && req.url === "/api/v1/2fa/totp/verify") {
    const body = await readJson(req);
    const code = typeof body.code === "string" ? body.code : "";
    const result = await databasePool.query(
      `SELECT secret_ciphertext, secret_iv, secret_tag FROM spaartrack.user_totp_factor
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
    if (!result.rowCount || !/^\d{6}$/.test(code)) {
      json(res, 401, { error: "TOTP_INVALID" });
      return true;
    }
    const expected = totpCode(decryptTotpSecret(result.rows[0]));
    const valid = timingSafeEqual(Buffer.from(code), Buffer.from(expected));
    json(res, valid ? 200 : 401, valid ? { verified: true } : { error: "TOTP_INVALID" });
    return true;
  }
  if (req.method === "DELETE" && req.url === "/api/v1/2fa/totp") {
    const result = await databasePool.query(
      `UPDATE spaartrack.user_totp_factor SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL RETURNING id`,
      [userId]
    );
    if (!result.rowCount) json(res, 404, { error: "TOTP_NOT_ENROLLED" });
    else {
      await auditEvent(req, res, userId, "REVOKE", "TOTP_FACTOR", String(result.rows[0].id));
      json(res, 200, { revoked: true, factor_id: result.rows[0].id });
    }
    return true;
  }
  return false;
}

async function sessionRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (req.method === "POST" && req.url === "/api/v1/sessions") {
    try {
      const body = await readJson(req);
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const requestedTtl = typeof body.ttl_seconds === "number" ? body.ttl_seconds : 3600;
      const ttlSeconds = Math.max(1, Math.min(86_400, Math.floor(requestedTtl)));
      const token = randomBytes(32).toString("base64url");
      const result = await databasePool.query(
        `INSERT INTO spaartrack.user_session (user_id, token_hash, expires_at)
         SELECT id, $2, now() + ($3 * interval '1 second')
         FROM spaartrack.app_user
         WHERE lower(email) = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
         RETURNING user_id, expires_at`,
        [email, sessionHash(token), ttlSeconds]
      );
      if (!result.rowCount) {
        json(res, 401, { error: "INVALID_LOGIN" });
      } else {
        await auditEvent(req, res, String(result.rows[0].user_id), "LOGIN", "USER", String(result.rows[0].user_id));
        json(res, 201, { token, ...sessionResponse(result.rows[0]) });
      }
    } catch (error) {
      console.error(redactedLog({ operation: "session_request_failed", error: error instanceof Error ? error.message : "unknown_error" }));
      json(res, 400, { error: "INVALID_SESSION_REQUEST" });
    }
    return true;
  }

  if (req.method === "GET" && req.url === "/api/v1/sessions/me") {
    const token = authorizationToken(req);
    if (!token) {
      json(res, 401, { error: "UNAUTHENTICATED" });
      return true;
    }
    const result = await databasePool.query(
      `SELECT s.user_id, s.expires_at
       FROM spaartrack.user_session s
       JOIN spaartrack.app_user u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
         AND u.status = 'ACTIVE' AND u.deleted_at IS NULL`,
      [sessionHash(token)]
    );
    if (!result.rowCount) json(res, 401, { error: "SESSION_INVALID_OR_EXPIRED" });
    else json(res, 200, sessionResponse(result.rows[0]));
    return true;
  }

  if (req.method === "DELETE" && req.url === "/api/v1/sessions/current") {
    const token = authorizationToken(req);
    if (!token) {
      json(res, 401, { error: "UNAUTHENTICATED" });
      return true;
    }
    const result = await databasePool.query(
      `UPDATE spaartrack.user_session SET revoked_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      [sessionHash(token)]
    );
    if (!result.rowCount) json(res, 401, { error: "SESSION_INVALID_OR_EXPIRED" });
    else {
      await auditEvent(req, res, String(result.rows[0].user_id), "REVOKE", "SESSION", String(result.rows[0].user_id));
      json(res, 200, { revoked: true, user_id: result.rows[0].user_id });
    }
    return true;
  }
  return false;
}

async function oidcRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;

  if (req.method === "POST" && req.url === "/api/v1/oidc/start") {
    try {
      const body = await readJson(req);
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const provider = body.provider === "synthetic" ? "synthetic" : "";
      if (!provider || !email) {
        json(res, 400, { error: "INVALID_OIDC_REQUEST" });
        return true;
      }
      const state = randomBytes(24).toString("base64url");
      const code = randomBytes(24).toString("base64url");
      const baseUrl = process.env.OIDC_BASE_URL || `http://${req.headers.host || "localhost:18080"}`;
      const redirectUri = `${baseUrl}/api/v1/oidc/callback`;
      const result = await databasePool.query(
        `INSERT INTO spaartrack.oidc_login_state (user_id, provider, state_hash, code_hash, redirect_uri, expires_at)
         SELECT id, $2, $3, $4, $5, now() + interval '5 minutes'
         FROM spaartrack.app_user
         WHERE lower(email) = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
         RETURNING expires_at`,
        [email, provider, sessionHash(state), sessionHash(code), redirectUri]
      );
      if (!result.rowCount) {
        json(res, 401, { error: "INVALID_LOGIN" });
        return true;
      }
      const callback = new URL(redirectUri);
      callback.searchParams.set("state", state);
      callback.searchParams.set("code", code);
      callback.searchParams.set("provider", provider);
      json(res, 201, {
        provider,
        state,
        authorization_url: callback.toString(),
        expires_at: result.rows[0].expires_at
      });
    } catch {
      json(res, 400, { error: "INVALID_OIDC_REQUEST" });
    }
    return true;
  }

  if (req.method === "GET" && req.url?.startsWith("/api/v1/oidc/callback")) {
    const callbackUrl = new URL(req.url, "http://localhost:18080");
    const state = callbackUrl.searchParams.get("state") || "";
    const code = callbackUrl.searchParams.get("code") || "";
    const provider = callbackUrl.searchParams.get("provider") || "";
    if (provider !== "synthetic" || !state || !code) {
      json(res, 401, { error: "OIDC_STATE_INVALID_OR_EXPIRED" });
      return true;
    }
    const pending = await databasePool.query(
      `SELECT id, user_id FROM spaartrack.oidc_login_state
       WHERE state_hash = $1 AND code_hash = $2 AND provider = $3
         AND consumed_at IS NULL AND expires_at > now()` ,
      [sessionHash(state), sessionHash(code), provider]
    );
    if (!pending.rowCount) {
      const stateExists = await databasePool.query(
        `SELECT 1 FROM spaartrack.oidc_login_state WHERE state_hash = $1`,
        [sessionHash(state)]
      );
      json(res, 401, { error: stateExists.rowCount ? "OIDC_STATE_REPLAYED" : "OIDC_STATE_INVALID_OR_EXPIRED" });
      return true;
    }
    const consumed = await databasePool.query(
      `UPDATE spaartrack.oidc_login_state SET consumed_at = now()
       WHERE id = $1 AND consumed_at IS NULL RETURNING user_id`,
      [pending.rows[0].id]
    );
    if (!consumed.rowCount) {
      json(res, 401, { error: "OIDC_STATE_REPLAYED" });
      return true;
    }
    const userId = String(consumed.rows[0].user_id);
    const identity = await databasePool.query(
      `INSERT INTO spaartrack.auth_identity (user_id, provider, subject, email)
       SELECT id, 'synthetic-oidc', 'synthetic:' || id::text, email
       FROM spaartrack.app_user WHERE id = $1
       ON CONFLICT (provider, subject) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [userId]
    );
    const session = await createSessionForUser(userId);
    await auditEvent(req, res, userId, "LOGIN", "USER", userId, { provider: "synthetic-oidc" });
    json(res, 200, {
      provider: "synthetic-oidc",
      user_id: userId,
      identity_id: identity.rows[0].id,
      token: session.token,
      expires_at: session.expiresAt
    });
    return true;
  }
  return false;
}

async function accountantShareRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || (!req.url?.startsWith("/api/v1/portfolios/") && !req.url?.startsWith("/api/v1/accountant-shares/"))) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const createMatch = req.url.match(/^\/api\/v1\/portfolios\/([0-9a-f-]{36})\/accountant-shares$/i);
  const revokeMatch = req.url.match(/^\/api\/v1\/accountant-shares\/([0-9a-f-]{36})\/revoke$/i);
  if (!createMatch && !revokeMatch) return false;
  try {
    if (createMatch) {
      const portfolioId = createMatch[1];
      const owner = await databasePool.query(
        `SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND role = 'OWNER' AND revoked_at IS NULL`,
        [portfolioId, userId]
      );
      if (!owner.rowCount) { json(res, 403, { error: "PORTFOLIO_OWNER_REQUIRED" }); return true; }
      if (req.method === "GET") {
        const shares = await databasePool.query(
          `SELECT id, portfolio_id, grantee_email, scope, expires_at, revoked_at, created_at
             FROM spaartrack.accountant_share WHERE portfolio_id = $1 ORDER BY created_at DESC`, [portfolioId]
        );
        json(res, 200, { portfolio_id: portfolioId, shares: shares.rows.map(accountantShareResponse), calculation_version: "accountant-access-v1" });
        return true;
      }
      if (req.method !== "POST") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
      const body = await readJson(req);
      const share = buildAccountantShare({ grantee_email: body.grantee_email, role: body.role, scope: body.scope, expires_at: body.expires_at }, new Date().toISOString());
      const result = await databasePool.query(
        `INSERT INTO spaartrack.accountant_share (portfolio_id, created_by, grantee_email, scope, expires_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, portfolio_id, grantee_email, scope, expires_at, revoked_at, created_at`,
        [portfolioId, userId, share.grantee_email, JSON.stringify({ role: share.role, permissions: share.scope }), share.expires_at]
      );
      await auditEvent(req, res, userId, "SHARE", "ACCOUNTANT_SHARE", String(result.rows[0].id), { portfolio_id: portfolioId, grantee_email: share.grantee_email, role: share.role, scope: share.scope, expires_at: share.expires_at });
      json(res, 201, { ...accountantShareResponse(result.rows[0]), calculation_version: "accountant-access-v1", privacy_scope: "portfolio_owner", audit_action: "SHARE" });
      return true;
    }
    if (!revokeMatch) { json(res, 404, { error: "NOT_FOUND" }); return true; }
    const shareId = revokeMatch[1];
    if (req.method !== "POST") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
    const share = await databasePool.query(
      `SELECT s.id, s.portfolio_id, s.grantee_email, s.scope, s.expires_at, s.revoked_at, s.created_at
         FROM spaartrack.accountant_share s
         JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = s.portfolio_id
        WHERE s.id = $1 AND pm.user_id = $2 AND pm.role = 'OWNER' AND pm.revoked_at IS NULL`, [shareId, userId]
    );
    if (!share.rowCount) { json(res, 404, { error: "ACCOUNTANT_SHARE_NOT_FOUND" }); return true; }
    const current = accountantShareResponse(share.rows[0]);
    if (current.status === "REVOKED") { json(res, 200, { ...current, calculation_version: "accountant-access-v1", audit_action: "REVOKE" }); return true; }
    const updated = await databasePool.query(
      `UPDATE spaartrack.accountant_share SET revoked_at = now() WHERE id = $1
       RETURNING id, portfolio_id, grantee_email, scope, expires_at, revoked_at, created_at`, [shareId]
    );
    await auditEvent(req, res, userId, "REVOKE", "ACCOUNTANT_SHARE", shareId, { portfolio_id: updated.rows[0].portfolio_id, grantee_email: updated.rows[0].grantee_email });
    json(res, 200, { ...accountantShareResponse(updated.rows[0]), calculation_version: "accountant-access-v1", audit_action: "REVOKE" });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status = ["INVALID_EMAIL", "INVALID_ROLE", "INVALID_SCOPE", "INVALID_EXPIRY", "EXPIRY_IN_PAST"].includes(message) ? 400 : 500;
    console.error(redactedLog({ level: "error", operation: "accountant_share_failed", error: message }));
    json(res, status, { error: status === 400 ? message : "ACCOUNTANT_SHARE_REQUEST_FAILED" });
    return true;
  }
}

function accountantShareResponse(row: Record<string, unknown>): Record<string, unknown> {
  const stored = row.scope && typeof row.scope === "object" ? row.scope as { role?: string; permissions?: string[] } : {};
  const expiresAt = row.expires_at ? new Date(String(row.expires_at)) : null;
  const status = row.revoked_at ? "REVOKED" : expiresAt && expiresAt.getTime() <= Date.now() ? "EXPIRED" : "ACTIVE";
  return { id: row.id, portfolio_id: row.portfolio_id, grantee_email: row.grantee_email, role: stored.role, scope: stored.permissions || [], expires_at: row.expires_at, revoked_at: row.revoked_at, created_at: row.created_at, status };
}

async function pushConsentRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/push-consents")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  await ensurePushConsentTable();
  const listMatch = req.url.match(/^\/api\/v1\/push-consents(\?.*)?$/i);
  const createMatch = req.url.match(/^\/api\/v1\/push-consents$/i);
  const revokeMatch = req.url.match(/^\/api\/v1\/push-consents\/([0-9a-f-]{36})\/revoke$/i);
  const deliveryMatch = req.url.match(/^\/api\/v1\/push-consents\/([0-9a-f-]{36})\/deliveries$/i);
  if (!listMatch && !revokeMatch && !deliveryMatch) return false;
  try {
    if (listMatch && req.method === "GET") {
      const rows = await databasePool.query(
        `SELECT id, channel, status, device_label, revoked_at, created_at FROM spaartrack.push_consent WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      json(res, 200, { consents: rows.rows.map(pushConsentResponse), calculation_version: "push-consent-v1" });
      return true;
    }
    if (createMatch && req.method === "POST") {
      const body = await readJson(req) as { channel?: string; enabled?: boolean; device_label?: string };
      const consent = validatePushConsent({ channel: body.channel, enabled: body.enabled, device_label: body.device_label });
      const result = await databasePool.query(
        `INSERT INTO spaartrack.push_consent (user_id, channel, status, device_label) VALUES ($1, $2, $3, $4)
         RETURNING id, channel, status, device_label, revoked_at, created_at`,
        [userId, consent.channel, consent.status, consent.device_label]
      );
      await auditEvent(req, res, userId, "SHARE", "PUSH_CONSENT", String(result.rows[0].id), { channel: consent.channel, status: consent.status });
      json(res, 201, { ...pushConsentResponse(result.rows[0]), calculation_version: "push-consent-v1", source: "push_consent", read_only: true, audit_action: "SHARE" });
      return true;
    }
    if (revokeMatch && req.method === "POST") {
      const current = await databasePool.query(
        `SELECT id, channel, status, device_label, revoked_at, created_at FROM spaartrack.push_consent WHERE id = $1 AND user_id = $2`,
        [revokeMatch[1], userId]
      );
      if (!current.rowCount) { json(res, 404, { error: "PUSH_CONSENT_NOT_FOUND" }); return true; }
      const updated = await databasePool.query(
        `UPDATE spaartrack.push_consent SET status = 'REVOKED', revoked_at = now() WHERE id = $1 AND user_id = $2
         RETURNING id, channel, status, device_label, revoked_at, created_at`,
        [revokeMatch[1], userId]
      );
      await auditEvent(req, res, userId, "REVOKE", "PUSH_CONSENT", String(revokeMatch[1]), { channel: updated.rows[0].channel });
      json(res, 200, { ...pushConsentResponse(updated.rows[0]), calculation_version: "push-consent-v1", audit_action: "PUSH_CONSENT_REVOKED" });
      return true;
    }
    if (deliveryMatch && req.method === "POST") {
      const current = await databasePool.query(
        `SELECT id, channel, status FROM spaartrack.push_consent WHERE id = $1 AND user_id = $2`,
        [deliveryMatch[1], userId]
      );
      if (!current.rowCount) { json(res, 404, { error: "PUSH_CONSENT_NOT_FOUND" }); return true; }
      const body = await readJson(req) as { event?: string; channel?: string; status?: string; failure_reason?: string };
      const delivery = recordPushDelivery({ event: body.event, channel: body.channel ?? current.rows[0].channel, status: body.status, failure_reason: body.failure_reason });
      const note = await databasePool.query(
        `INSERT INTO spaartrack.notification (user_id, notification_type, title, body, severity, payload, delivered_at)
         VALUES ($1, 'PUSH_DELIVERY', $2, $3, $4, $5, now())
         RETURNING id, notification_type, title, body, severity, payload, delivered_at, created_at`,
        [userId, String(delivery.event), `Push ${delivery.delivery_status}: ${delivery.event}`, delivery.delivery_status === "FAILED" ? "ERROR" : "INFO", JSON.stringify({ event: delivery.event, channel: delivery.channel, delivery_status: delivery.delivery_status, failure_reason: delivery.failure_reason, calculation_version: "push-delivery-v1" })]
      );
      await auditEvent(req, res, userId, "SHARE", "PUSH_DELIVERY", String(note.rows[0].id), { event: delivery.event, channel: delivery.channel, delivery_status: delivery.delivery_status });
      json(res, 201, { ...delivery, notification_id: note.rows[0].id, consent_id: deliveryMatch[1] });
      return true;
    }
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status = ["INVALID_PUSH_CONSENT", "INVALID_PUSH_DELIVERY"].includes(message) ? 400 : 500;
    console.error(redactedLog({ level: "error", operation: "push_consent_failed", error: message }));
    json(res, status, { error: status === 400 ? message : "PUSH_CONSENT_REQUEST_FAILED" });
    return true;
  }
}

async function ensurePushConsentTable(): Promise<void> {
  await databasePool.query(`CREATE TABLE IF NOT EXISTS spaartrack.push_consent (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES spaartrack.app_user(id) ON DELETE CASCADE,
    channel text NOT NULL CHECK (channel IN ('PUSH', 'IN_APP', 'EMAIL')),
    status text NOT NULL DEFAULT 'GRANTED' CHECK (status IN ('GRANTED', 'REVOKED')),
    device_label text NOT NULL DEFAULT '',
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
}

function pushConsentResponse(row: Record<string, unknown>): Record<string, unknown> {
  return { id: row.id, channel: row.channel, status: row.status, device_label: row.device_label, revoked_at: row.revoked_at, created_at: row.created_at };
}

async function modelSessionRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/model-sessions")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  await ensureModelSessionTable();
  const listMatch = req.url.match(/^\/api\/v1\/model-sessions(\?.*)?$/i);
  const createMatch = req.url.match(/^\/api\/v1\/model-sessions$/i);
  const revokeMatch = req.url.match(/^\/api\/v1\/model-sessions\/([0-9a-f-]{36})\/revoke$/i);
  if (!listMatch && !revokeMatch) return false;
  try {
    if (listMatch && req.method === "GET") {
      const rows = await databasePool.query(
        `SELECT id, provider, model, key_source, key_material, vault_path, session_label, status, revoked_at, created_at FROM spaartrack.model_session WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      json(res, 200, { sessions: rows.rows, calculation_version: "model-session-v1" });
      return true;
    }
    if (createMatch && req.method === "POST") {
      const body = await readJson(req) as { provider?: string; model?: string; key_source?: string; vault_path?: string; session_label?: string; provider_key?: unknown };
      const session = buildModelSession(body);
      const result = await databasePool.query(
        `INSERT INTO spaartrack.model_session (user_id, provider, model, key_source, key_material, vault_path, session_label, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
         RETURNING id, provider, model, key_source, key_material, vault_path, session_label, status, revoked_at, created_at`,
        [userId, session.provider, session.model, session.key_source, session.key_material, session.vault_path, session.session_label]
      );
      await auditEvent(req, res, userId, "SHARE", "MODEL_SESSION", String(result.rows[0].id), { provider: session.provider, model: session.model, key_source: session.key_source });
      json(res, 201, { ...result.rows[0], calculation_version: "model-session-v1", source: "model_session", read_only: true, audit_action: "SHARE" });
      return true;
    }
    if (revokeMatch && req.method === "POST") {
      const current = await databasePool.query(
        `SELECT id FROM spaartrack.model_session WHERE id = $1 AND user_id = $2`,
        [revokeMatch[1], userId]
      );
      if (!current.rowCount) { json(res, 404, { error: "MODEL_SESSION_NOT_FOUND" }); return true; }
      const updated = await databasePool.query(
        `UPDATE spaartrack.model_session SET status = 'REVOKED', revoked_at = now() WHERE id = $1 AND user_id = $2
         RETURNING id, provider, model, key_source, key_material, vault_path, session_label, status, revoked_at, created_at`,
        [revokeMatch[1], userId]
      );
      await auditEvent(req, res, userId, "REVOKE", "MODEL_SESSION", String(revokeMatch[1]), { provider: updated.rows[0].provider, model: updated.rows[0].model });
      json(res, 200, { ...updated.rows[0], calculation_version: "model-session-v1", audit_action: "MODEL_SESSION_REVOKED" });
      return true;
    }
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status = message === "INVALID_MODEL_SESSION" ? 400 : 500;
    console.error(redactedLog({ level: "error", operation: "model_session_failed", error: message }));
    json(res, status, { error: status === 400 ? message : "MODEL_SESSION_REQUEST_FAILED" });
    return true;
  }
}

async function ensureModelSessionTable(): Promise<void> {
  await databasePool.query(`CREATE TABLE IF NOT EXISTS spaartrack.model_session (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES spaartrack.app_user(id) ON DELETE CASCADE,
    provider text NOT NULL,
    model text NOT NULL,
    key_source text NOT NULL CHECK (key_source IN ('BYOK', 'LOCAL')),
    key_material text NOT NULL DEFAULT 'vault-only' CHECK (key_material = 'vault-only'),
    vault_path text NOT NULL,
    session_label text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
}

async function assistantAnswerRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/assistant-answers")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "POST" || req.url !== "/api/v1/assistant-answers") return false;
  try {
    const body = await readJson(req) as { question?: string; domain?: string; period_start?: string; period_end?: string; data_as_of?: string; read_scopes?: string[]; account_scope?: string[]; confidence?: number; summary?: string; mutation_tool_used?: boolean };
    const answer = buildAssistantAnswer(body);
    await auditEvent(req, res, userId, "CALCULATE", "ASSISTANT_ANSWER", randomUUID(), { domain: answer.domain, period: answer.period, read_scopes: answer.read_scopes });
    json(res, 201, { ...answer, audit_action: "ASSISTANT_ANSWER" });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status = message === "INVALID_ASSISTANT_ANSWER" ? 400 : 500;
    const trace = traceId(req);
    const correlation = correlationId(req);
    console.error(redactedLog({ level: "error", operation: "assistant_answer_failed", error: message, trace_id: trace, correlation_id: correlation }));
    json(res, status, { error: status === 400 ? message : "ASSISTANT_ANSWER_REQUEST_FAILED", trace_id: trace, correlation_id: correlation });
    return true;
  }
}

const assistantProposalStore = new Map<string, string>();

async function agentScopesRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (req.url !== "/api/v1/agent-scopes") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET") return false;
  const matrix = buildAgentScopeMatrix();
  await auditEvent(req, res, userId, "CALCULATE", "AGENT_SCOPES", randomUUID(), { version: matrix.version });
  json(res, 200, { ...matrix, source: "agent_scope_matrix", audit_action: "AGENT_SCOPES" });
  return true;
}

async function addonSandboxRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/addons")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  await ensureAddonSandboxTables();
  const collection = req.url === "/api/v1/addons";
  const actionMatch = req.url.match(/^\/api\/v1\/addons\/([0-9a-f-]{36})\/(sandbox\/(start|stop)|revoke)$/i);
  if (!collection && !actionMatch) return false;
  try {
    if (collection && req.method === "GET") {
      const result = await databasePool.query(`SELECT id, slug, version, manifest_json, status, created_at FROM spaartrack.addon_manifest WHERE owner_user_id = $1 ORDER BY created_at DESC`, [userId]);
      json(res, 200, { addons: result.rows, calculation_version: "addon-sandbox-v1", source: "addon_manifest" });
      return true;
    }
    if (collection && req.method === "POST") {
      const body = await readJson(req) as { manifest?: Record<string, unknown> };
      const manifest = validateAddonManifest(body.manifest ?? {});
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        const inserted = await client.query(`INSERT INTO spaartrack.addon_manifest (owner_user_id, slug, version, manifest_json, status) VALUES ($1, $2, $3, $4, 'INSTALLED') RETURNING id, slug, version, status, created_at`, [userId, manifest.slug, manifest.version, JSON.stringify(manifest)]);
        const addonId = String(inserted.rows[0].id);
        for (const permission of manifest.permissions) await client.query(`INSERT INTO spaartrack.addon_grant (addon_id, user_id, permission) VALUES ($1, $2, $3)`, [addonId, userId, permission]);
        for (const secret of manifest.secrets) await client.query(`INSERT INTO spaartrack.addon_secret_ref (addon_id, secret_name, vault_path) VALUES ($1, $2, $3)`, [addonId, secret.name, secret.vault_path]);
        for (const eventName of manifest.entrypoints.events) await client.query(`INSERT INTO spaartrack.addon_event_hook (addon_id, event_name) VALUES ($1, $2)`, [addonId, eventName]);
        for (const asset of manifest.assets) await client.query(`INSERT INTO spaartrack.addon_asset (addon_id, asset_path, content_type, sha256) VALUES ($1, $2, $3, $4)`, [addonId, asset.path, asset.content_type, asset.sha256]);
        const plan = buildAddonSandboxPlan({ addon_id: addonId, permissions: manifest.permissions, assets: manifest.assets.map((asset) => asset.path), event_hooks: manifest.entrypoints.events });
        const sandbox = await client.query(`INSERT INTO spaartrack.addon_sandbox_run (addon_id, status, permissions, asset_root, ledger_access) VALUES ($1, 'STOPPED', $2, $3, 'none') RETURNING id, status, permissions, asset_root, ledger_access`, [addonId, JSON.stringify(plan.granted_permissions), plan.asset_root]);
        await client.query("COMMIT");
        await auditEvent(req, res, userId, "SHARE", "ADDON", addonId, { permissions: manifest.permissions, secret_count: manifest.secrets.length, asset_count: manifest.assets.length, ledger_untouched: true });
        json(res, 201, { id: addonId, ...inserted.rows[0], sandbox: { ...sandbox.rows[0], calculation_version: "addon-sandbox-v1", ledger_access: "none", revokable: true }, secret_count: manifest.secrets.length, asset_count: manifest.assets.length, event_hook_count: manifest.entrypoints.events.length, calculation_version: "addon-sandbox-v1", source: "addon_manifest", ledger_untouched: true });
        return true;
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    }
    if (actionMatch && req.method === "POST") {
      const addonId = actionMatch[1];
      const action = actionMatch[2].toLowerCase();
      const current = await databasePool.query(`SELECT id FROM spaartrack.addon_manifest WHERE id = $1 AND owner_user_id = $2`, [addonId, userId]);
      if (!current.rowCount) { json(res, 404, { error: "ADDON_NOT_FOUND" }); return true; }
      if (action === "revoke") {
        const client = await databasePool.connect();
        try {
          await client.query("BEGIN");
          await client.query(`UPDATE spaartrack.addon_manifest SET status = 'REVOKED' WHERE id = $1 AND owner_user_id = $2`, [addonId, userId]);
          const grants = await client.query(`UPDATE spaartrack.addon_grant SET revoked_at = COALESCE(revoked_at, now()) WHERE addon_id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING permission`, [addonId, userId]);
          const secrets = await client.query(`UPDATE spaartrack.addon_secret_ref SET status = 'REVOKED', revoked_at = COALESCE(revoked_at, now()) WHERE addon_id = $1 AND status = 'ACTIVE' RETURNING id`, [addonId]);
          await client.query(`UPDATE spaartrack.addon_event_hook SET status = 'REVOKED', revoked_at = COALESCE(revoked_at, now()) WHERE addon_id = $1 AND status = 'ACTIVE'`, [addonId]);
          await client.query(`UPDATE spaartrack.addon_sandbox_run SET status = 'REVOKED', revoked_at = COALESCE(revoked_at, now()), updated_at = now() WHERE addon_id = $1`, [addonId]);
          await client.query("COMMIT");
          await auditEvent(req, res, userId, "REVOKE", "ADDON", addonId, { grants_revoked: grants.rowCount, secrets_revoked: secrets.rowCount, ledger_untouched: true });
          json(res, 200, { id: addonId, status: "REVOKED", grants_revoked: grants.rowCount, secrets_revoked: secrets.rowCount, ledger_untouched: true, calculation_version: "addon-sandbox-v1", audit_action: "ADDON_REVOKED" });
          return true;
        } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
      }
      const desired = action.endsWith("start") ? "RUNNING" : "STOPPED";
      const updated = await databasePool.query(`UPDATE spaartrack.addon_sandbox_run SET status = $1, started_at = CASE WHEN $1 = 'RUNNING' THEN COALESCE(started_at, now()) ELSE started_at END, stopped_at = CASE WHEN $1 = 'STOPPED' THEN now() ELSE stopped_at END, updated_at = now() WHERE addon_id = $2 AND status <> 'REVOKED' RETURNING id, status, permissions, asset_root, ledger_access`, [desired, addonId]);
      if (!updated.rowCount) { json(res, 409, { error: "ADDON_REVOKED" }); return true; }
      await auditEvent(req, res, userId, desired === "RUNNING" ? "START" : "STOP", "ADDON_SANDBOX", addonId, { status: desired, ledger_untouched: true });
      json(res, 200, { id: addonId, sandbox: { ...updated.rows[0], calculation_version: "addon-sandbox-v1", revokable: true }, ledger_untouched: true, audit_action: `ADDON_SANDBOX_${desired}` });
      return true;
    }
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status = message === "INVALID_ADDON_MANIFEST" || message === "INVALID_ADDON_SANDBOX" ? 400 : 500;
    console.error(redactedLog({ level: "error", operation: "addon_sandbox_failed", error: message }));
    json(res, status, { error: status === 400 ? message : "ADDON_SANDBOX_REQUEST_FAILED" });
    return true;
  }
}

async function ensureAddonSandboxTables(): Promise<void> {
  await databasePool.query(`CREATE TABLE IF NOT EXISTS spaartrack.addon_secret_ref (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), addon_id uuid NOT NULL REFERENCES spaartrack.addon_manifest(id) ON DELETE CASCADE, secret_name text NOT NULL, vault_path text NOT NULL CHECK (vault_path LIKE 'vault://%'), status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')), revoked_at timestamptz, UNIQUE (addon_id, secret_name));
    CREATE TABLE IF NOT EXISTS spaartrack.addon_event_hook (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), addon_id uuid NOT NULL REFERENCES spaartrack.addon_manifest(id) ON DELETE CASCADE, event_name text NOT NULL, status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')), revoked_at timestamptz, UNIQUE (addon_id, event_name));
    CREATE TABLE IF NOT EXISTS spaartrack.addon_asset (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), addon_id uuid NOT NULL REFERENCES spaartrack.addon_manifest(id) ON DELETE CASCADE, asset_path text NOT NULL, content_type text NOT NULL, sha256 text NOT NULL, UNIQUE (addon_id, asset_path));
    CREATE TABLE IF NOT EXISTS spaartrack.addon_sandbox_run (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), addon_id uuid NOT NULL REFERENCES spaartrack.addon_manifest(id) ON DELETE CASCADE, status text NOT NULL DEFAULT 'STOPPED' CHECK (status IN ('STOPPED', 'RUNNING', 'REVOKED')), permissions jsonb NOT NULL DEFAULT '[]', asset_root text NOT NULL, ledger_access text NOT NULL DEFAULT 'none' CHECK (ledger_access = 'none'), started_at timestamptz, stopped_at timestamptz, revoked_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now())`);
}

async function addonSdkRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/addons/")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  await ensureAddonSandboxTables();
  const readMatch = req.url.match(/^\/api\/v1\/addons\/([0-9a-f-]{36})\/sdk\/read$/i);
  const eventMatch = req.url.match(/^\/api\/v1\/addons\/([0-9a-f-]{36})\/events\/([A-Za-z0-9_.-]{2,64})\/(emit|revoke)$/i);
  if (!readMatch && !eventMatch) return false;
  try {
    const addonId = (readMatch ?? eventMatch)![1];
    const addon = await databasePool.query(`SELECT id, status, manifest_json FROM spaartrack.addon_manifest WHERE id = $1 AND owner_user_id = $2`, [addonId, userId]);
    if (!addon.rowCount) { json(res, 404, { error: "ADDON_NOT_FOUND" }); return true; }
    if (String(addon.rows[0].status) !== "INSTALLED") { json(res, 409, { error: "ADDON_REVOKED" }); return true; }
    const manifest = addon.rows[0].manifest_json as { permissions?: string[]; entrypoints?: { events?: string[] } };
    if (readMatch && req.method === "POST") {
      const body = await readJson(req) as { resource?: string };
      const read = buildAddonSdkRead({ permissions: manifest.permissions, resource: body.resource });
      await auditEvent(req, res, userId, "READ", "ADDON_SDK", addonId, { resource: read.resource, capability: read.capability, ledger_untouched: true });
      json(res, 200, { addon_id: addonId, ...read, audit_action: "ADDON_SDK_READ" });
      return true;
    }
    if (eventMatch && req.method === "POST") {
      const eventName = String(eventMatch[2]).toUpperCase();
      const hook = validateAddonEventHook({ event_name: eventName, registered_events: manifest.entrypoints?.events ?? [] });
      if (eventMatch[3].toLowerCase() === "revoke") {
        const revoked = await databasePool.query(`UPDATE spaartrack.addon_event_hook SET status = 'REVOKED', revoked_at = COALESCE(revoked_at, now()) WHERE addon_id = $1 AND event_name = $2 AND status = 'ACTIVE' RETURNING event_name`, [addonId, hook.event_name]);
        if (!revoked.rowCount) { json(res, 409, { error: "ADDON_EVENT_REVOKED" }); return true; }
        await auditEvent(req, res, userId, "REVOKE", "ADDON_EVENT_HOOK", addonId, { event_name: hook.event_name, ledger_untouched: true });
        json(res, 200, { addon_id: addonId, event_name: hook.event_name, status: "REVOKED", calculation_version: "addon-sdk-v1", audit_action: "ADDON_EVENT_REVOKED", ledger_untouched: true });
        return true;
      }
      const active = await databasePool.query(`SELECT id FROM spaartrack.addon_event_hook WHERE addon_id = $1 AND event_name = $2 AND status = 'ACTIVE'`, [addonId, hook.event_name]);
      if (!active.rowCount) { json(res, 403, { error: "ADDON_EVENT_REVOKED" }); return true; }
      const body = await readJson(req) as { payload?: unknown };
      await auditEvent(req, res, userId, "DELIVER", "ADDON_EVENT", addonId, { event_name: hook.event_name, payload_present: body.payload !== undefined, ledger_untouched: true });
      json(res, 200, { addon_id: addonId, event_name: hook.event_name, delivered: true, payload_scoped: true, calculation_version: "addon-sdk-v1", audit_action: "ADDON_EVENT_DELIVERED", ledger_untouched: true });
      return true;
    }
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status = ["ADDON_SCOPE_DENIED", "ADDON_EVENT_NOT_GRANTED", "INVALID_ADDON_EVENT"].includes(message) ? 403 : 500;
    console.error(redactedLog({ level: "error", operation: "addon_sdk_failed", error: message }));
    json(res, status, { error: status === 403 ? message : "ADDON_SDK_REQUEST_FAILED" });
    return true;
  }
}

async function assistantProposalRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/assistant-proposals")) return false;  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "POST" || (req.url !== "/api/v1/assistant-proposals" && !req.url?.startsWith("/api/v1/assistant-proposals/"))) return false;
  const decisionMatch = req.url?.match(/^\/api\/v1\/assistant-proposals\/([0-9a-f-]{36})\/(confirm|cancel)$/i);
  if (decisionMatch && req.method === "POST") {
    try {
      const body = await readJson(req) as { undo_token?: string };
      const stored = assistantProposalStore.get(decisionMatch[1]);
      const decision = decideAssistantProposal({ undo_token: stored ?? String(body.undo_token ?? "") }, { decision: decisionMatch[2], undo_token: String(body.undo_token ?? "") });
      if (stored !== undefined && stored !== String(body.undo_token ?? "")) throw new Error("INVALID_PROPOSAL_DECISION");
      await auditEvent(req, res, userId, "CALCULATE", "ASSISTANT_PROPOSAL_DECISION", decisionMatch[1], { decision: decision.status, undo_token: decision.undo_token });
      json(res, 200, { ...decision, proposal_id: decisionMatch[1], audit_action: "ASSISTANT_PROPOSAL_DECISION" });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      const status = message === "INVALID_PROPOSAL_DECISION" ? 400 : 500;
      json(res, status, { error: status === 400 ? message : "ASSISTANT_PROPOSAL_DECISION_FAILED" });
      return true;
    }
  }
  if (req.url !== "/api/v1/assistant-proposals") return false;
  try {
    const body = await readJson(req) as { question?: string; kind?: string; diff?: Array<{ op: string; target: string; before: string; after: string }>; scope?: string[]; impact?: string; summary?: string; mutation_tool_used?: boolean };
    const proposal = buildAssistantProposal(body);
    const proposalId = randomUUID();
    assistantProposalStore.set(proposalId, proposal.undo_token);
    await auditEvent(req, res, userId, "CALCULATE", "ASSISTANT_PROPOSAL", proposalId, { kind: proposal.kind, diff_count: proposal.diff.length, scope: proposal.scope });
    json(res, 201, { ...proposal, proposal_id: proposalId, audit_action: "ASSISTANT_PROPOSAL" });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status = message === "INVALID_ASSISTANT_PROPOSAL" ? 400 : 500;
    console.error(redactedLog({ level: "error", operation: "assistant_proposal_failed", error: message }));
    json(res, status, { error: status === 400 ? message : "ASSISTANT_PROPOSAL_REQUEST_FAILED" });
    return true;
  }
}

function communityPostResponse(row: Record<string, unknown>): Record<string, unknown> {
  const visibility = String(row.visibility);
  const status = String(row.status);
  return {
    id: row.id,
    visibility,
    status,
    title: row.title,
    body: row.body,
    public_metrics: visibility === "PUBLIC" && status === "VISIBLE" ? (row.public_metrics ?? {}) : {},
    created_at: row.created_at,
    deleted_at: row.deleted_at,
    calculation_version: "community-feed-v1",
    source: "community_post",
    read_only: true
  };
}

async function ensureCommunityPostTable(): Promise<void> {
  await databasePool.query(`CREATE TABLE IF NOT EXISTS spaartrack.community_post (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id uuid NOT NULL REFERENCES spaartrack.app_user(id) ON DELETE CASCADE,
    visibility text NOT NULL CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
    status text NOT NULL CHECK (status IN ('VISIBLE', 'PRIVATE', 'PENDING', 'REJECTED', 'DELETED')),
    title text NOT NULL,
    body text NOT NULL,
    public_metrics jsonb NOT NULL DEFAULT '{}',
    moderation_reason text,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS community_post_feed_idx ON spaartrack.community_post (status, visibility, created_at DESC);
  CREATE INDEX IF NOT EXISTS community_post_owner_idx ON spaartrack.community_post (owner_user_id, created_at DESC)`);
}

async function communityFeedRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/community/")) return false;
  await ensureCommunityPostTable();
  const userId = await authenticatedUserId(req);
  const parsed = new URL(req.url, "http://localhost");
  if (parsed.pathname === "/api/v1/community/feed" && req.method === "GET") {
    const rows = await databasePool.query(`SELECT id, visibility, status, title, body, public_metrics, created_at, deleted_at
      FROM spaartrack.community_post WHERE visibility = 'PUBLIC' AND status = 'VISIBLE' ORDER BY created_at DESC LIMIT 100`);
    json(res, 200, { posts: rows.rows.map(communityPostResponse), count: rows.rowCount, calculation_version: "community-feed-v1", source: "community_post", read_only: true });
    return true;
  }
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (parsed.pathname === "/api/v1/community/posts" && req.method === "POST") {
    try {
      const body = await readJson(req) as { visibility?: string; title?: string; body?: string; public_metrics?: Record<string, unknown> };
      const post = buildCommunityPost(body, new Date().toISOString());
      const result = await databasePool.query(`INSERT INTO spaartrack.community_post (owner_user_id, visibility, status, title, body, public_metrics)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id, visibility, status, title, body, public_metrics, created_at, deleted_at`,
        [userId, post.visibility, post.status, post.title, post.body, JSON.stringify(post.public_metrics)]);
      await auditEvent(req, res, userId, "SHARE", "COMMUNITY_POST", String(result.rows[0].id), { visibility: post.visibility, moderation_status: post.status });
      json(res, 201, { ...communityPostResponse(result.rows[0]), audit_action: "COMMUNITY_POST_CREATED" });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      const status = ["INVALID_COMMUNITY_POST", "PRIVATE_DATA_IN_PUBLIC_POST"].includes(message) ? 400 : 500;
      json(res, status, { error: status === 400 ? message : "COMMUNITY_POST_REQUEST_FAILED" });
      return true;
    }
  }
  if (parsed.pathname === "/api/v1/community/export" && req.method === "GET") {
    const rows = await databasePool.query(`SELECT id, visibility, status, title, body, public_metrics FROM spaartrack.community_post WHERE owner_user_id = $1 ORDER BY created_at`, [userId]);
    json(res, 200, buildCommunityExport(rows.rows as Array<{ id: string; visibility: "PUBLIC" | "PRIVATE"; status: "VISIBLE" | "PRIVATE" | "PENDING" | "REJECTED" | "DELETED"; title: string; body: string; public_metrics?: Record<string, unknown> }>));
    return true;
  }
  const postMatch = parsed.pathname.match(/^\/api\/v1\/community\/posts\/([0-9a-f-]{36})(?:\/(moderate|delete))?$/i);
  if (!postMatch) return false;
  const post = await databasePool.query(`SELECT id, visibility, status, title, body, public_metrics, created_at, deleted_at FROM spaartrack.community_post WHERE id = $1 AND owner_user_id = $2`, [postMatch[1], userId]);
  if (!post.rowCount) { json(res, 404, { error: "COMMUNITY_POST_NOT_FOUND" }); return true; }
  if (postMatch[2] === "moderate" && req.method === "POST") {
    const body = await readJson(req) as { decision?: string };
    const decision = String(body.decision ?? "").toUpperCase();
    if (!["APPROVE", "REJECT"].includes(decision)) { json(res, 400, { error: "INVALID_MODERATION_DECISION" }); return true; }
    const status = decision === "APPROVE" ? "VISIBLE" : "REJECTED";
    const updated = await databasePool.query(`UPDATE spaartrack.community_post SET status = $2, moderation_reason = $3, updated_at = now() WHERE id = $1 RETURNING id, visibility, status, title, body, public_metrics, created_at, deleted_at`, [postMatch[1], status, decision === "REJECT" ? "MODERATOR_REJECTED" : null]);
    await auditEvent(req, res, userId, "MODERATION", "COMMUNITY_POST", postMatch[1], { decision, status });
    json(res, 200, { ...communityPostResponse(updated.rows[0]), audit_action: "COMMUNITY_POST_MODERATED" });
    return true;
  }
  if (postMatch[2] === "delete" && req.method === "POST") {
    const updated = await databasePool.query(`UPDATE spaartrack.community_post SET status = 'DELETED', deleted_at = now(), updated_at = now() WHERE id = $1 RETURNING id, visibility, status, title, body, public_metrics, created_at, deleted_at`, [postMatch[1]]);
    await auditEvent(req, res, userId, "DELETE", "COMMUNITY_POST", postMatch[1], { deletion: "TOMBSTONE" });
    json(res, 200, { ...communityPostResponse(updated.rows[0]), audit_action: "COMMUNITY_POST_DELETED" });
    return true;
  }
  if (req.method === "GET") { json(res, 200, communityPostResponse(post.rows[0])); return true; }
  json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  return true;
}

function shareLinkResponse(row: Record<string, unknown>): Record<string, unknown> {
  const policy = row.exposure_policy && typeof row.exposure_policy === "object" ? row.exposure_policy as { hide_amounts?: boolean } : {};
  const expiresAt = row.expires_at ? new Date(String(row.expires_at)) : null;
  const status = row.revoked_at ? "REVOKED" : expiresAt && expiresAt.getTime() <= Date.now() ? "EXPIRED" : "ACTIVE";
  return { id: row.id, portfolio_id: row.portfolio_id, access_id: row.access_id, scope: row.scope, exposure_policy: { hide_amounts: Boolean(policy.hide_amounts) }, expires_at: row.expires_at, revoked_at: row.revoked_at, created_at: row.created_at, status, calculation_version: "portfolio-share-link-v1", source: "portfolio_share_link", read_only: true };
}

async function portfolioShareLinkRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const parsed = req.url ? new URL(req.url, "http://localhost") : null;
  const createMatch = req.url?.match(/^\/api\/v1\/portfolios\/([0-9a-f-]{36})\/share-links$/i);
  const revokeMatch = req.url?.match(/^\/api\/v1\/share-links\/([0-9a-f-]{36})\/revoke$/i);
  const resolveMatch = req.url?.match(/^\/api\/v1\/shared\/([A-Za-z0-9_-]{12,})$/);
  if (!createMatch && !revokeMatch && !resolveMatch && !(parsed && parsed.pathname === "/api/v1/portfolios" && false)) {
    if (!req.url?.startsWith("/api/v1/portfolios/") && !req.url?.startsWith("/api/v1/share-links/") && !req.url?.startsWith("/api/v1/shared/")) return false;
    if (!createMatch && !revokeMatch && !resolveMatch) return false;
  }
  if (resolveMatch) {
    if (req.method !== "GET") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
    const row = await databasePool.query(
      `SELECT id, portfolio_id::text AS portfolio_id, access_id, scope, exposure_policy, expires_at, revoked_at, created_at
         FROM spaartrack.portfolio_share_link WHERE access_id = $1`, [resolveMatch[1]]
    );
    if (!row.rowCount) { json(res, 404, { error: "SHARE_LINK_NOT_FOUND" }); return true; }
    const link = shareLinkResponse(row.rows[0]);
    if (link.status === "REVOKED") { json(res, 410, { error: "SHARE_LINK_REVOKED" }); return true; }
    if (link.status === "EXPIRED") { json(res, 410, { error: "SHARE_LINK_EXPIRED" }); return true; }
    if (link.scope === "RESTRICTED_VIEW") {
      const snapshot = await databasePool.query(
        `SELECT id, portfolio_value::text AS portfolio_value, reporting_currency_code
           FROM spaartrack.portfolio_snapshot WHERE portfolio_id = $1 ORDER BY snapshot_at DESC, id DESC LIMIT 1`,
        [link.portfolio_id]
      );
      if (!snapshot.rowCount) { json(res, 404, { error: "SHARE_LINK_NO_SNAPSHOT" }); return true; }
      const positions = await databasePool.query(
        `SELECT ps.instrument_id::text AS instrument_id, COALESCE(i.name, ps.instrument_id::text) AS name,
                COALESCE(ps.reporting_value, ps.market_value, 0)::text AS market_value
           FROM spaartrack.position_snapshot ps LEFT JOIN spaartrack.instrument i ON i.id = ps.instrument_id
          WHERE ps.portfolio_snapshot_id = $1 AND COALESCE(ps.reporting_value, ps.market_value, 0) > 0
          ORDER BY ps.instrument_id`,
        [snapshot.rows[0].id]
      );
      try {
        const restricted = projectRestrictedView({
          positions: positions.rows as Array<{ instrument_id?: string; name?: string; market_value?: number | string; currency_code?: string }>,
          portfolio_value: String(snapshot.rows[0].portfolio_value),
          currency_code: String(snapshot.rows[0].reporting_currency_code)
        });
        json(res, 200, { ...link, restricted_view: restricted, trace_id: traceId(req), correlation_id: correlationId(req) });
      } catch {
        json(res, 409, { error: "SHARE_LINK_NO_SNAPSHOT" });
      }
      return true;
    }
    json(res, 200, { ...link, trace_id: traceId(req), correlation_id: correlationId(req) });
    return true;
  }
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  try {
    if (createMatch) {
      const portfolioId = createMatch[1];
      const owner = await databasePool.query(
        `SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND role = 'OWNER' AND revoked_at IS NULL`,
        [portfolioId, userId]
      );
      if (!owner.rowCount) { json(res, 403, { error: "PORTFOLIO_OWNER_REQUIRED" }); return true; }
      if (req.method === "GET") {
        const links = await databasePool.query(
          `SELECT id, portfolio_id::text AS portfolio_id, access_id, scope, exposure_policy, expires_at, revoked_at, created_at
             FROM spaartrack.portfolio_share_link WHERE portfolio_id = $1 ORDER BY created_at DESC`, [portfolioId]
        );
        json(res, 200, { portfolio_id: portfolioId, links: links.rows.map(shareLinkResponse), count: links.rowCount, calculation_version: "portfolio-share-link-v1" });
        return true;
      }
      if (req.method !== "POST") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
      const body = await readJson(req);
      const link = buildPortfolioShareLink(
        { scope: body.scope as string | undefined, exposure_policy: (body.exposure_policy && typeof body.exposure_policy === "object" ? body.exposure_policy : {}) as Record<string, unknown>, expires_at: (body.expires_at as string | null | undefined) ?? null },
        new Date().toISOString()
      );
      const result = await databasePool.query(
        `INSERT INTO spaartrack.portfolio_share_link (portfolio_id, created_by, access_id, scope, exposure_policy, expires_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id, portfolio_id::text AS portfolio_id, access_id, scope, exposure_policy, expires_at, revoked_at, created_at`,
        [portfolioId, userId, link.access_id, link.scope, JSON.stringify(link.exposure_policy), link.expires_at]
      );
      await auditEvent(req, res, userId, "SHARE", "PORTFOLIO_SHARE_LINK", String(result.rows[0].id), { portfolio_id: portfolioId, scope: link.scope, expires_at: link.expires_at });
      json(res, 201, { ...shareLinkResponse(result.rows[0]), trace_id: traceId(req), correlation_id: correlationId(req) });
      return true;
    }
    if (revokeMatch) {
      if (req.method !== "POST") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
      const link = await databasePool.query(
        `SELECT l.id, l.portfolio_id::text AS portfolio_id, l.access_id, l.scope, l.exposure_policy, l.expires_at, l.revoked_at, l.created_at
           FROM spaartrack.portfolio_share_link l JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = l.portfolio_id
          WHERE l.id = $1 AND pm.user_id = $2 AND pm.role = 'OWNER' AND pm.revoked_at IS NULL`, [revokeMatch[1], userId]
      );
      if (!link.rowCount) { json(res, 404, { error: "SHARE_LINK_NOT_FOUND" }); return true; }
      const current = shareLinkResponse(link.rows[0]);
      if (current.status === "REVOKED") { json(res, 200, { ...current, audit_action: "REVOKE" }); return true; }
      const updated = await databasePool.query(
        `UPDATE spaartrack.portfolio_share_link SET revoked_at = now() WHERE id = $1
         RETURNING id, portfolio_id::text AS portfolio_id, access_id, scope, exposure_policy, expires_at, revoked_at, created_at`, [revokeMatch[1]]
      );
      await auditEvent(req, res, userId, "REVOKE", "PORTFOLIO_SHARE_LINK", revokeMatch[1], { portfolio_id: updated.rows[0].portfolio_id });
      json(res, 200, { ...shareLinkResponse(updated.rows[0]), audit_action: "REVOKE" });
      return true;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "INVALID_SHARE_LINK") { json(res, 400, { error: message }); return true; }
    console.error(redactedLog({ level: "error", operation: "portfolio_share_link_failed", error: message }));
    json(res, 500, { error: "SHARE_LINK_REQUEST_FAILED" });
    return true;
  }
  return false;
}

async function portfolioRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/v1/portfolios") {
    try {
      const body = await readJson(req);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const currency = typeof body.reporting_currency_code === "string" ? body.reporting_currency_code.trim().toUpperCase() : "EUR";
      const privacyScope = typeof body.privacy_scope === "string" ? body.privacy_scope.trim().toUpperCase() : "PRIVATE";
      if (!name || !/^[A-Z]{3}$/.test(currency) || !["PRIVATE", "SHARED", "PUBLIC"].includes(privacyScope)) {
        json(res, 400, { error: "INVALID_PORTFOLIO_INPUT" });
        return true;
      }
      const result = await databasePool.query(
        `INSERT INTO spaartrack.portfolio (owner_user_id, name, reporting_currency_code, privacy_scope)
         VALUES ($1, $2, $3, $4)
         RETURNING id, owner_user_id, name, description, status, reporting_currency_code, privacy_scope, created_at, updated_at`,
        [userId, name, currency, privacyScope]
      );
      const portfolio = result.rows[0];
      await databasePool.query(
        `INSERT INTO spaartrack.portfolio_member (portfolio_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
        [portfolio.id, userId]
      );
      json(res, 201, { ...portfolio, role: "OWNER" });
    } catch {
      json(res, 400, { error: "INVALID_PORTFOLIO_REQUEST" });
    }
    return true;
  }

  const memberMatch = req.url?.match(/^\/api\/v1\/portfolios\/([0-9a-f-]+)\/members$/i);
  if (req.method === "POST" && memberMatch) {
    try {
      const owner = await databasePool.query(
        `SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND role = 'OWNER' AND revoked_at IS NULL`,
        [memberMatch[1], userId]
      );
      if (!owner.rowCount) {
        json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
        return true;
      }
      const body = await readJson(req);
      const memberUserId = typeof body.user_id === "string" ? body.user_id : "";
      const role = typeof body.role === "string" ? body.role : "";
      if (!memberUserId || !portfolioRoles.includes(role as PortfolioRole) || role === "OWNER") {
        json(res, 400, { error: "INVALID_PORTFOLIO_ROLE" });
        return true;
      }
      const result = await databasePool.query(
        `INSERT INTO spaartrack.portfolio_member (portfolio_id, user_id, role, revoked_at)
         SELECT $1, id, $3, NULL FROM spaartrack.app_user WHERE id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
         ON CONFLICT (portfolio_id, user_id) DO UPDATE SET role = EXCLUDED.role, revoked_at = NULL
         RETURNING portfolio_id, user_id, role`,
        [memberMatch[1], memberUserId, role]
      );
      if (!result.rowCount) json(res, 404, { error: "USER_NOT_FOUND" });
      else {
        await auditEvent(req, res, userId, "PERMISSION_CHANGE", "PORTFOLIO", memberMatch[1], { user_id: memberUserId, role });
        await auditEvent(req, res, userId, "SHARE", "PORTFOLIO", memberMatch[1], { user_id: memberUserId, role });
        json(res, 201, result.rows[0]);
      }
    } catch {
      json(res, 400, { error: "INVALID_PORTFOLIO_MEMBER_REQUEST" });
    }
    return true;
  }

  const portfolioMatch = req.url?.match(/^\/api\/v1\/portfolios\/([0-9a-f-]+)$/i);
  if (portfolioMatch && (req.method === "GET" || req.method === "PATCH")) {
    const access = await databasePool.query(
      `SELECT p.id, p.owner_user_id, p.name, p.description, p.status, p.reporting_currency_code, p.privacy_scope,
              p.created_at, p.updated_at, pm.role
       FROM spaartrack.portfolio p
       JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = p.id
       WHERE p.id = $1 AND pm.user_id = $2 AND pm.revoked_at IS NULL AND p.status <> 'DELETED'`,
      [portfolioMatch[1], userId]
    );
    if (!access.rowCount) {
      json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
      return true;
    }
    if (req.method === "GET") {
      json(res, 200, access.rows[0]);
      return true;
    }
    if (!["OWNER", "EDITOR"].includes(String(access.rows[0].role))) {
      json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
      return true;
    }
    try {
      const body = await readJson(req);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        json(res, 400, { error: "INVALID_PORTFOLIO_INPUT" });
        return true;
      }
      const updated = await databasePool.query(
        `UPDATE spaartrack.portfolio SET name = $1, updated_at = now() WHERE id = $2
         RETURNING id, owner_user_id, name, description, status, reporting_currency_code, privacy_scope, created_at, updated_at`,
        [name, portfolioMatch[1]]
      );
      json(res, 200, { ...updated.rows[0], role: access.rows[0].role });
    } catch {
      json(res, 400, { error: "INVALID_PORTFOLIO_REQUEST" });
    }
    return true;
  }
  return false;
}

function accountResponse(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    portfolio_id: row.portfolio_id,
    name: row.name,
    account_type: row.account_type,
    tracking_mode: row.tracking_mode,
    status: row.status,
    institution_name: row.institution_name,
    base_currency_code: row.base_currency_code,
  };
}

function currencyResponse(row: Record<string, unknown>): Record<string, unknown> {
  return { code: row.code, name: row.name, minor_units: row.minor_units, is_crypto: row.is_crypto };
}

async function marketDataRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }

  if (req.method === "GET" && req.url === "/api/v1/currencies") {
    const result = await databasePool.query(
      "SELECT code, name, minor_units, is_crypto FROM spaartrack.currency ORDER BY code"
    );
    json(res, 200, { currencies: result.rows.map(currencyResponse) });
    return true;
  }

  const ratesUrl = req.url?.startsWith("/api/v1/fx/rates") ? new URL(req.url, "http://localhost") : null;
  if (req.method === "GET" && ratesUrl) {
    const base = ratesUrl.searchParams.get("base_currency_code")?.trim().toUpperCase() || "";
    const quote = ratesUrl.searchParams.get("quote_currency_code")?.trim().toUpperCase() || "";
    if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote) || base === quote) {
      json(res, 400, { error: "INVALID_FX_RATE_PAIR" });
      return true;
    }
    const result = await databasePool.query(
      `SELECT base_currency_code, quote_currency_code, rate_at, rate::text, source, source_version, captured_at
       FROM spaartrack.fx_rate
       WHERE base_currency_code = $1 AND quote_currency_code = $2
       ORDER BY rate_at DESC, source, source_version`,
      [base, quote]
    );
    if (!result.rowCount) {
      json(res, 404, { error: "FX_RATE_NOT_FOUND" });
      return true;
    }
    json(res, 200, { rates: result.rows });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/v1/fx/rates") {
    try {
      const body = await readJson(req);
      const base = typeof body.base_currency_code === "string" ? body.base_currency_code.trim().toUpperCase() : "";
      const quote = typeof body.quote_currency_code === "string" ? body.quote_currency_code.trim().toUpperCase() : "";
      const rateAt = typeof body.rate_at === "string" ? body.rate_at : "";
      const rate = typeof body.rate === "number" ? String(body.rate) : typeof body.rate === "string" ? body.rate.trim() : "";
      const source = typeof body.source === "string" ? body.source.trim() : "";
      const sourceVersion = typeof body.source_version === "string" ? body.source_version.trim() : "";
      if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote) || base === quote ||
          !rateAt || Number.isNaN(Date.parse(rateAt)) || !/^\d+(\.\d+)?$/.test(rate) || Number(rate) <= 0 ||
          !source || !sourceVersion) {
        json(res, 400, { error: "INVALID_FX_RATE_INPUT" });
        return true;
      }
      const currencies = await databasePool.query(
        "SELECT code FROM spaartrack.currency WHERE code IN ($1, $2)", [base, quote]
      );
      if (currencies.rowCount !== 2) {
        json(res, 400, { error: "UNKNOWN_CURRENCY" });
        return true;
      }
      const result = await databasePool.query(
        `INSERT INTO spaartrack.fx_rate
           (base_currency_code, quote_currency_code, rate_at, rate, source, source_version)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING
         RETURNING base_currency_code, quote_currency_code, rate_at, rate::text, source, source_version, captured_at`,
        [base, quote, rateAt, rate, source, sourceVersion]
      );
      if (!result.rowCount) {
        json(res, 409, { error: "FX_RATE_ALREADY_EXISTS" });
        return true;
      }
      json(res, 201, result.rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        json(res, 409, { error: "FX_RATE_ALREADY_EXISTS" });
      } else if ((error as { code?: string }).code === "23503") {
        json(res, 400, { error: "UNKNOWN_CURRENCY" });
      } else {
        json(res, 400, { error: "INVALID_FX_RATE_REQUEST" });
      }
    }
    return true;
  }

  const pricesUrl = req.url?.startsWith("/api/v1/instrument-prices") ? new URL(req.url, "http://localhost") : null;
  if (req.method === "GET" && pricesUrl) {
    const instrumentId = pricesUrl.searchParams.get("instrument_id")?.trim() || "";
    if (!/^[0-9a-f-]{36}$/i.test(instrumentId)) {
      json(res, 400, { error: "INVALID_PRICE_QUERY" });
      return true;
    }
    const instrument = await databasePool.query(
      "SELECT 1 FROM spaartrack.instrument WHERE id = $1", [instrumentId]
    );
    if (!instrument.rowCount) {
      json(res, 404, { error: "INSTRUMENT_NOT_FOUND" });
      return true;
    }
    const result = await databasePool.query(
      `SELECT instrument_id, price_at, price::text, currency_code, source, is_close, captured_at
       FROM spaartrack.instrument_price
       WHERE instrument_id = $1
       ORDER BY price_at DESC, source`,
      [instrumentId]
    );
    json(res, 200, { prices: result.rows });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/v1/instrument-prices") {
    try {
      const body = await readJson(req);
      const instrumentId = typeof body.instrument_id === "string" ? body.instrument_id.trim() : "";
      const priceAt = typeof body.price_at === "string" ? body.price_at : "";
      const price = typeof body.price === "number" ? String(body.price) : typeof body.price === "string" ? body.price.trim() : "";
      const currencyCode = typeof body.currency_code === "string" ? body.currency_code.trim().toUpperCase() : "";
      const source = typeof body.source === "string" ? body.source.trim() : "";
      const isClose = typeof body.is_close === "boolean" ? body.is_close : false;
      if (!/^[0-9a-f-]{36}$/i.test(instrumentId) || !priceAt || Number.isNaN(Date.parse(priceAt)) ||
          !/^\d+(\.\d+)?$/.test(price) || Number(price) < 0 || !/^[A-Z]{3}$/.test(currencyCode) || !source) {
        json(res, 400, { error: "INVALID_PRICE_INPUT" });
        return true;
      }
      const references = await databasePool.query(
        `SELECT
           EXISTS (SELECT 1 FROM spaartrack.instrument WHERE id = $1) AS instrument_exists,
           EXISTS (SELECT 1 FROM spaartrack.currency WHERE code = $2) AS currency_exists`,
        [instrumentId, currencyCode]
      );
      if (!references.rows[0].instrument_exists) {
        json(res, 404, { error: "INSTRUMENT_NOT_FOUND" });
        return true;
      }
      if (!references.rows[0].currency_exists) {
        json(res, 400, { error: "UNKNOWN_CURRENCY" });
        return true;
      }
      const result = await databasePool.query(
        `INSERT INTO spaartrack.instrument_price
           (instrument_id, price_at, price, currency_code, source, is_close)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING
         RETURNING instrument_id, price_at, price::text, currency_code, source, is_close, captured_at`,
        [instrumentId, priceAt, price, currencyCode, source, isClose]
      );
      if (!result.rowCount) {
        json(res, 409, { error: "PRICE_ALREADY_EXISTS" });
        return true;
      }
      json(res, 201, result.rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        json(res, 409, { error: "PRICE_ALREADY_EXISTS" });
      } else if ((error as { code?: string }).code === "23503") {
        json(res, 400, { error: "INVALID_PRICE_REFERENCE" });
      } else {
        json(res, 400, { error: "INVALID_PRICE_REQUEST" });
      }
    }
    return true;
  }
  return false;
}

function instrumentMappingResponse(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    provider_id: row.provider_id,
    provider_slug: row.provider_slug,
    provider_symbol: row.provider_symbol,
    instrument_id: row.instrument_id,
    identifier_type: row.identifier_type,
    identifier_value: row.identifier_value,
    status: row.status,
    created_by: row.created_by,
    resolved_at: row.resolved_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function instrumentMappingRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }

  const mappingMatch = req.url?.match(/^\/api\/v1\/instrument-mappings\/([0-9a-f-]{36})$/i);
  if (req.method === "PATCH" && mappingMatch) {
    try {
      const body = await readJson(req);
      const instrumentId = typeof body.instrument_id === "string" ? body.instrument_id.trim() : "";
      const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
      if (!/^[0-9a-f-]{36}$/i.test(instrumentId) || status !== "RESOLVED") {
        json(res, 400, { error: "INVALID_MAPPING_RESOLUTION" });
        return true;
      }
      const instrument = await databasePool.query("SELECT 1 FROM spaartrack.instrument WHERE id = $1", [instrumentId]);
      if (!instrument.rowCount) {
        json(res, 404, { error: "INSTRUMENT_NOT_FOUND" });
        return true;
      }
      const result = await databasePool.query(
        `UPDATE spaartrack.instrument_mapping
         SET instrument_id = $1, status = 'RESOLVED', resolved_at = now(), updated_at = now()
         WHERE id = $2
         RETURNING id, provider_id, provider_symbol, instrument_id, identifier_type, identifier_value,
                   status, created_by, resolved_at, created_at, updated_at`,
        [instrumentId, mappingMatch[1]]
      );
      if (!result.rowCount) {
        json(res, 404, { error: "MAPPING_NOT_FOUND" });
        return true;
      }
      const provider = await databasePool.query("SELECT slug AS provider_slug FROM spaartrack.provider WHERE id = $1", [result.rows[0].provider_id]);
      json(res, 200, instrumentMappingResponse({ ...result.rows[0], provider_slug: provider.rows[0]?.provider_slug }));
    } catch {
      json(res, 400, { error: "INVALID_MAPPING_RESOLUTION" });
    }
    return true;
  }

  const mappingsUrl = req.url?.startsWith("/api/v1/instrument-mappings") ? new URL(req.url, "http://localhost") : null;
  if (req.method === "GET" && mappingsUrl) {
    const status = mappingsUrl.searchParams.get("status")?.trim().toUpperCase() || "";
    if (status && !["UNRESOLVED", "RESOLVED", "REJECTED"].includes(status)) {
      json(res, 400, { error: "INVALID_MAPPING_STATUS" });
      return true;
    }
    const result = await databasePool.query(
      `SELECT m.id, m.provider_id, p.slug AS provider_slug, m.provider_symbol, m.instrument_id,
              m.identifier_type, m.identifier_value, m.status, m.created_by, m.resolved_at,
              m.created_at, m.updated_at
       FROM spaartrack.instrument_mapping m
       JOIN spaartrack.provider p ON p.id = m.provider_id
       WHERE ($1 = '' OR m.status = $1)
       ORDER BY m.created_at DESC, m.id`,
      [status]
    );
    json(res, 200, { mappings: result.rows.map(instrumentMappingResponse) });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/v1/instrument-mappings") {
    try {
      const body = await readJson(req);
      const providerSlug = typeof body.provider_slug === "string" ? body.provider_slug.trim().toLowerCase() : "";
      const providerSymbol = typeof body.provider_symbol === "string" ? body.provider_symbol.trim() : "";
      const instrumentId = typeof body.instrument_id === "string" ? body.instrument_id.trim() : "";
      const identifierType = typeof body.identifier_type === "string" ? body.identifier_type.trim().toUpperCase() : null;
      const identifierValue = typeof body.identifier_value === "string" ? body.identifier_value.trim().toUpperCase() : null;
      if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(providerSlug) || !providerSymbol || providerSymbol.length > 160 ||
          (instrumentId && !/^[0-9a-f-]{36}$/i.test(instrumentId)) ||
          (identifierType !== null && !["ISIN", "CUSIP"].includes(identifierType)) ||
          ((identifierType === null) !== (identifierValue === null)) || (identifierValue !== null && !identifierValue)) {
        json(res, 400, { error: "INVALID_MAPPING_INPUT" });
        return true;
      }
      if (instrumentId) {
        const instrument = await databasePool.query("SELECT 1 FROM spaartrack.instrument WHERE id = $1", [instrumentId]);
        if (!instrument.rowCount) {
          json(res, 404, { error: "INSTRUMENT_NOT_FOUND" });
          return true;
        }
      }
      const provider = await databasePool.query(
        `INSERT INTO spaartrack.provider (slug, name, provider_type)
         VALUES ($1, $1, 'MARKET_DATA')
         ON CONFLICT (slug) DO UPDATE SET status = 'ACTIVE'
         RETURNING id, slug`,
        [providerSlug]
      );
      const resolved = Boolean(instrumentId);
      const result = await databasePool.query(
        `INSERT INTO spaartrack.instrument_mapping
           (provider_id, provider_symbol, instrument_id, identifier_type, identifier_value, status, created_by, resolved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $6 = 'RESOLVED' THEN now() ELSE NULL END)
         ON CONFLICT (provider_id, provider_symbol) DO NOTHING
         RETURNING id, provider_id, provider_symbol, instrument_id, identifier_type, identifier_value,
                   status, created_by, resolved_at, created_at, updated_at`,
        [provider.rows[0].id, providerSymbol, instrumentId || null, identifierType, identifierValue, resolved ? "RESOLVED" : "UNRESOLVED", userId]
      );
      if (!result.rowCount) {
        json(res, 409, { error: "MAPPING_ALREADY_EXISTS" });
        return true;
      }
      json(res, 201, instrumentMappingResponse({ ...result.rows[0], provider_slug: provider.rows[0].slug }));
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        json(res, 409, { error: "MAPPING_ALREADY_EXISTS" });
      } else if ((error as { code?: string }).code === "23503") {
        json(res, 400, { error: "INVALID_MAPPING_REFERENCE" });
      } else {
        json(res, 400, { error: "INVALID_MAPPING_REQUEST" });
      }
    }
    return true;
  }
  return false;
}

async function accountRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }

  const accountMatch = req.url?.match(/^\/api\/v1\/accounts\/([0-9a-f-]+)$/i);
  if (req.method === "GET" && accountMatch) {
    const access = await databasePool.query(
      `SELECT fa.id, fa.portfolio_id, fa.name, fa.account_type, fa.tracking_mode, fa.status,
              fa.institution_name, fa.base_currency_code, fa.created_at, fa.updated_at
       FROM spaartrack.financial_account fa
       JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = fa.portfolio_id
       JOIN spaartrack.portfolio p ON p.id = fa.portfolio_id
       WHERE fa.id = $1 AND pm.user_id = $2 AND pm.revoked_at IS NULL AND p.status <> 'DELETED'`,
      [accountMatch[1], userId]
    );
    if (!access.rowCount) {
      json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
      return true;
    }
    json(res, 200, accountResponse(access.rows[0]));
    return true;
  }

  if (req.method === "POST" && req.url === "/api/v1/accounts") {
    try {
      const body = await readJson(req);
      const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const accountType = typeof body.account_type === "string" ? body.account_type.trim().toUpperCase() : "";
      const trackingMode = typeof body.tracking_mode === "string" ? body.tracking_mode.trim().toUpperCase() : "TRANSACTIONS";
      const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "ACTIVE";
      const baseCurrency = typeof body.base_currency_code === "string" ? body.base_currency_code.trim().toUpperCase() : "EUR";
      if (!portfolioId || !name || !accountTypes.includes(accountType as typeof accountTypes[number]) ||
          !trackingModes.includes(trackingMode as typeof trackingModes[number]) ||
          !accountStatuses.includes(status as typeof accountStatuses[number]) || !/^[A-Z]{3}$/.test(baseCurrency)) {
        json(res, 400, { error: "INVALID_ACCOUNT_INPUT" });
        return true;
      }
      const access = await databasePool.query(
        `SELECT pm.role FROM spaartrack.portfolio_member pm
         JOIN spaartrack.portfolio p ON p.id = pm.portfolio_id
         WHERE pm.portfolio_id = $1 AND pm.user_id = $2 AND pm.revoked_at IS NULL
           AND p.status <> 'DELETED'`,
        [portfolioId, userId]
      );
      if (!access.rowCount || !["OWNER", "EDITOR"].includes(String(access.rows[0].role))) {
        json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
        return true;
      }
      const result = await databasePool.query(
        `INSERT INTO spaartrack.financial_account
           (portfolio_id, name, account_type, tracking_mode, status, base_currency_code)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, portfolio_id, name, account_type, tracking_mode, status,
                   institution_name, base_currency_code, created_at, updated_at`,
        [portfolioId, name, accountType, trackingMode, status, baseCurrency]
      );
      json(res, 201, accountResponse(result.rows[0]));
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        json(res, 409, { error: "ACCOUNT_NAME_ALREADY_EXISTS" });
      } else if ((error as { code?: string }).code === "23503") {
        json(res, 400, { error: "INVALID_ACCOUNT_REFERENCE" });
      } else {
        json(res, 400, { error: "INVALID_ACCOUNT_REQUEST" });
      }
    }
    return true;
  }
  return false;
}

function moneyFlowAccountResponse(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    portfolio_id: row.portfolio_id,
    user_id: row.user_id,
    financial_account_id: row.financial_account_id,
    name: row.name,
    account_type: row.account_type,
    base_currency_code: row.base_currency_code,
    is_enabled: row.is_enabled
  };
}

async function moneyFlowAccountScopeRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }
  const parsed = new URL(req.url || "/", "http://localhost");
  const scopePath = "/api/v1/money-flow/account-scope";
  if (req.method === "GET" && parsed.pathname === scopePath) {
    const portfolioId = parsed.searchParams.get("portfolio_id") || "";
    const access = await databasePool.query(
      `SELECT pm.role FROM spaartrack.portfolio_member pm
       JOIN spaartrack.portfolio p ON p.id = pm.portfolio_id
       WHERE pm.portfolio_id = $1 AND pm.user_id = $2 AND pm.revoked_at IS NULL AND p.status <> 'DELETED'`,
      [portfolioId, userId]
    );
    if (!access.rowCount) {
      json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
      return true;
    }
    const accounts = await databasePool.query(
      `SELECT fa.id, fa.portfolio_id, $2::uuid AS user_id, fa.id AS financial_account_id,
              fa.name, fa.account_type, fa.base_currency_code,
              COALESCE(mas.is_enabled, false) AS is_enabled
       FROM spaartrack.financial_account fa
       LEFT JOIN spaartrack.money_flow_account_scope mas
         ON mas.financial_account_id = fa.id AND mas.portfolio_id = fa.portfolio_id AND mas.user_id = $2
       WHERE fa.portfolio_id = $1 AND fa.account_type IN ('BANK', 'CASH', 'CREDIT_CARD')
         AND fa.status <> 'ARCHIVED'
       ORDER BY fa.name, fa.id`,
      [portfolioId, userId]
    );
    json(res, 200, { portfolio_id: portfolioId, accounts: accounts.rows.map(moneyFlowAccountResponse) });
    return true;
  }
  if (req.method === "PUT" && parsed.pathname === scopePath) {
    try {
      const body = await readJson(req);
      const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id : "";
      const accountId = typeof body.financial_account_id === "string" ? body.financial_account_id : "";
      const isEnabled = typeof body.is_enabled === "boolean" ? body.is_enabled : null;
      if (!portfolioId || !accountId || isEnabled === null) {
        json(res, 400, { error: "INVALID_MONEY_FLOW_SCOPE_INPUT" });
        return true;
      }
      const account = await databasePool.query(
        `SELECT fa.id, fa.portfolio_id, fa.name, fa.account_type, fa.base_currency_code
         FROM spaartrack.financial_account fa
         JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = fa.portfolio_id
         JOIN spaartrack.portfolio p ON p.id = fa.portfolio_id
         WHERE fa.id = $1 AND fa.portfolio_id = $2 AND pm.user_id = $3
           AND pm.revoked_at IS NULL AND p.status <> 'DELETED'`,
        [accountId, portfolioId, userId]
      );
      if (!account.rowCount) {
        json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
        return true;
      }
      if (!["BANK", "CASH", "CREDIT_CARD"].includes(String(account.rows[0].account_type))) {
        json(res, 400, { error: "MONEY_FLOW_ACCOUNT_TYPE_NOT_ELIGIBLE" });
        return true;
      }
      const result = await databasePool.query(
        `INSERT INTO spaartrack.money_flow_account_scope
           (portfolio_id, user_id, financial_account_id, is_enabled)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (portfolio_id, user_id, financial_account_id)
         DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = now()
         RETURNING portfolio_id, user_id, financial_account_id, is_enabled`,
        [portfolioId, userId, accountId, isEnabled]
      );
      await auditEvent(req, res, userId, "MONEY_FLOW_SCOPE_CHANGE", "FINANCIAL_ACCOUNT", accountId, { portfolio_id: portfolioId, is_enabled: isEnabled });
      json(res, 200, moneyFlowAccountResponse({ ...account.rows[0], ...result.rows[0], id: accountId }));
    } catch {
      json(res, 400, { error: "INVALID_MONEY_FLOW_SCOPE_REQUEST" });
    }
    return true;
  }
  return false;
}

const moneyFlowIncomeActivities = new Set(["CREDIT", "DIVIDEND", "INTEREST", "REFUND", "REBATE", "RETURN_OF_CAPITAL", "STAKING_REWARD", "BONUS", "DIVIDEND_IN_KIND"]);
const moneyFlowSavingActivities = new Set(["DEPOSIT", "BUY", "SELL"]);
const moneyFlowNeutralActivities = new Set(["TRANSFER_IN", "TRANSFER_OUT", "LIABILITY_PAYMENT"]);

function moneyFlowCategory(activityType: string): "INCOME" | "SPENDING" | "SAVING" | "TRANSFER" {
  if (moneyFlowNeutralActivities.has(activityType)) return "TRANSFER";
  if (moneyFlowIncomeActivities.has(activityType)) return "INCOME";
  if (moneyFlowSavingActivities.has(activityType)) return "SAVING";
  return "SPENDING";
}

const moneyFlowCategoryTypes = ["INCOME", "SPENDING", "SAVING", "TRANSFER", "TAX", "FEE", "UNCATEGORIZED"] as const;

function moneyFlowCategoryResponse(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    user_id: row.user_id,
    parent_id: row.parent_id,
    category_type: row.category_type,
    name: row.name,
    color: row.color,
    is_system: row.is_system,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeMoneyFlowPayeeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function moneyFlowPayeeResponse(row: Record<string, unknown>): Record<string, unknown> {
  return { id: row.id, user_id: row.user_id, name: row.name, normalized_name: row.normalized_name, is_active: row.is_active };
}

function moneyFlowTagResponse(row: Record<string, unknown>): Record<string, unknown> {
  return { id: row.id, user_id: row.user_id, name: row.name, color: row.color };
}

async function moneyFlowPayeesTagsRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/money-flow/")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const parsed = new URL(req.url, "http://localhost");
  const path = parsed.pathname;
  const payeeMatch = path.match(/^\/api\/v1\/money-flow\/payees\/([0-9a-f-]{36})$/i);
  const tagMatch = path.match(/^\/api\/v1\/money-flow\/tags\/([0-9a-f-]{36})$/i);
  try {
    if (path === "/api/v1/money-flow/payees" && req.method === "GET") {
      const result = await databasePool.query("SELECT id, user_id, name, normalized_name, is_active FROM spaartrack.payee WHERE user_id = $1 ORDER BY is_active DESC, name", [userId]);
      json(res, 200, { payees: result.rows.map(moneyFlowPayeeResponse), calculation_version: "money-flow-payees-v1" });
      return true;
    }
    if (path === "/api/v1/money-flow/payees" && req.method === "POST") {
      const body = await readJson(req);
      const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
      const normalizedName = normalizeMoneyFlowPayeeName(name);
      if (!name || name.length > 120 || !normalizedName) { json(res, 400, { error: "INVALID_MONEY_FLOW_PAYEE_INPUT" }); return true; }
      const existing = await databasePool.query("SELECT id FROM spaartrack.payee WHERE user_id = $1 AND normalized_name = $2", [userId, normalizedName]);
      if (existing.rowCount) { json(res, 409, { error: "PAYEE_ALREADY_EXISTS" }); return true; }
      const result = await databasePool.query("INSERT INTO spaartrack.payee (user_id, name, normalized_name) VALUES ($1, $2, $3) RETURNING id, user_id, name, normalized_name, is_active", [userId, name, normalizedName]);
      await auditEvent(req, res, userId, "MONEY_FLOW_PAYEE_CREATE", "PAYEE", String(result.rows[0].id), { name, normalized_name: normalizedName });
      json(res, 201, moneyFlowPayeeResponse(result.rows[0]));
      return true;
    }
    if (payeeMatch && req.method === "PATCH") {
      const body = await readJson(req);
      const current = await databasePool.query("SELECT id, user_id, name, normalized_name, is_active FROM spaartrack.payee WHERE id = $1 AND user_id = $2", [payeeMatch[1], userId]);
      if (!current.rowCount) { json(res, 404, { error: "PAYEE_NOT_FOUND" }); return true; }
      const name = body.name === undefined ? String(current.rows[0].name) : typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
      const normalizedName = normalizeMoneyFlowPayeeName(name);
      const isActive = body.is_active === undefined ? Boolean(current.rows[0].is_active) : body.is_active;
      if (!name || name.length > 120 || typeof isActive !== "boolean") { json(res, 400, { error: "INVALID_MONEY_FLOW_PAYEE_UPDATE" }); return true; }
      const conflict = await databasePool.query("SELECT 1 FROM spaartrack.payee WHERE user_id = $1 AND normalized_name = $2 AND id <> $3", [userId, normalizedName, payeeMatch[1]]);
      if (conflict.rowCount) { json(res, 409, { error: "PAYEE_ALREADY_EXISTS" }); return true; }
      const result = await databasePool.query("UPDATE spaartrack.payee SET name = $2, normalized_name = $3, is_active = $4 WHERE id = $1 AND user_id = $5 RETURNING id, user_id, name, normalized_name, is_active", [payeeMatch[1], name, normalizedName, isActive, userId]);
      await auditEvent(req, res, userId, "MONEY_FLOW_PAYEE_UPDATE", "PAYEE", payeeMatch[1], { name, normalized_name: normalizedName, is_active: isActive });
      json(res, 200, moneyFlowPayeeResponse(result.rows[0]));
      return true;
    }
    if (path === "/api/v1/money-flow/tags" && req.method === "GET") {
      const result = await databasePool.query("SELECT id, user_id, name, color FROM spaartrack.transaction_tag WHERE user_id = $1 ORDER BY name", [userId]);
      json(res, 200, { tags: result.rows.map(moneyFlowTagResponse), calculation_version: "money-flow-tags-v1" });
      return true;
    }
    if (path === "/api/v1/money-flow/tags" && req.method === "POST") {
      const body = await readJson(req);
      const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
      const color = typeof body.color === "string" && body.color.trim() ? body.color.trim() : null;
      if (!name || name.length > 80 || (color && !/^#[0-9a-f]{6}$/i.test(color))) { json(res, 400, { error: "INVALID_MONEY_FLOW_TAG_INPUT" }); return true; }
      const existing = await databasePool.query("SELECT id FROM spaartrack.transaction_tag WHERE user_id = $1 AND name = $2", [userId, name]);
      if (existing.rowCount) { json(res, 409, { error: "TAG_ALREADY_EXISTS" }); return true; }
      const result = await databasePool.query("INSERT INTO spaartrack.transaction_tag (user_id, name, color) VALUES ($1, $2, $3) RETURNING id, user_id, name, color", [userId, name, color]);
      await auditEvent(req, res, userId, "MONEY_FLOW_TAG_CREATE", "TAG", String(result.rows[0].id), { name, color });
      json(res, 201, moneyFlowTagResponse(result.rows[0]));
      return true;
    }
    if (tagMatch && req.method === "PATCH") {
      const body = await readJson(req);
      const current = await databasePool.query("SELECT id, user_id, name, color FROM spaartrack.transaction_tag WHERE id = $1 AND user_id = $2", [tagMatch[1], userId]);
      if (!current.rowCount) { json(res, 404, { error: "TAG_NOT_FOUND" }); return true; }
      const name = body.name === undefined ? String(current.rows[0].name) : typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
      const color = body.color === undefined ? current.rows[0].color : typeof body.color === "string" && body.color.trim() ? body.color.trim() : null;
      if (!name || name.length > 80 || (color && !/^#[0-9a-f]{6}$/i.test(color))) { json(res, 400, { error: "INVALID_MONEY_FLOW_TAG_UPDATE" }); return true; }
      const conflict = await databasePool.query("SELECT 1 FROM spaartrack.transaction_tag WHERE user_id = $1 AND name = $2 AND id <> $3", [userId, name, tagMatch[1]]);
      if (conflict.rowCount) { json(res, 409, { error: "TAG_ALREADY_EXISTS" }); return true; }
      const result = await databasePool.query("UPDATE spaartrack.transaction_tag SET name = $2, color = $3 WHERE id = $1 AND user_id = $4 RETURNING id, user_id, name, color", [tagMatch[1], name, color, userId]);
      await auditEvent(req, res, userId, "MONEY_FLOW_TAG_UPDATE", "TAG", tagMatch[1], { name, color });
      json(res, 200, moneyFlowTagResponse(result.rows[0]));
      return true;
    }
    if (path === "/api/v1/money-flow/transactions/bulk-edit" && req.method === "POST") {
      const body = await readJson(req);
      const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
      const transactionIds = Array.isArray(body.transaction_ids) ? [...new Set(body.transaction_ids.filter((value): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)))] : [];
      const payeeId = body.payee_id === null || body.payee_id === undefined || body.payee_id === "" ? null : typeof body.payee_id === "string" ? body.payee_id.trim() : "";
      const tagIds = Array.isArray(body.tag_ids) ? [...new Set(body.tag_ids.filter((value): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)))] : [];
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || transactionIds.length === 0 || transactionIds.length > 500 || (payeeId !== null && !/^[0-9a-f-]{36}$/i.test(payeeId))) { json(res, 400, { error: "INVALID_MONEY_FLOW_BULK_EDIT" }); return true; }
      const access = await databasePool.query("SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL AND role IN ('OWNER', 'EDITOR')", [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
      if (payeeId) {
        const payee = await databasePool.query("SELECT 1 FROM spaartrack.payee WHERE id = $1 AND user_id = $2 AND is_active = true", [payeeId, userId]);
        if (!payee.rowCount) { json(res, 404, { error: "PAYEE_NOT_FOUND" }); return true; }
      }
      if (tagIds.length) {
        const tags = await databasePool.query("SELECT id FROM spaartrack.transaction_tag WHERE user_id = $1 AND id = ANY($2::uuid[])", [userId, tagIds]);
        if (tags.rowCount !== tagIds.length) { json(res, 400, { error: "TAG_USER_MISMATCH" }); return true; }
      }
      const transactionCheck = await databasePool.query("SELECT id FROM spaartrack.ledger_transaction WHERE portfolio_id = $1 AND id = ANY($2::uuid[])", [portfolioId, transactionIds]);
      if (transactionCheck.rowCount !== transactionIds.length) { json(res, 400, { error: "TRANSACTION_PORTFOLIO_MISMATCH" }); return true; }
      await databasePool.query("INSERT INTO spaartrack.transaction_category (ledger_transaction_id, payee_id, classification_source, reviewed_by, reviewed_at) SELECT value::uuid, $2, 'MANUAL', $3, now() FROM unnest($1::text[]) AS value ON CONFLICT (ledger_transaction_id) DO UPDATE SET payee_id = EXCLUDED.payee_id, classification_source = 'MANUAL', reviewed_by = EXCLUDED.reviewed_by, reviewed_at = now()", [transactionIds, payeeId, userId]);
      await databasePool.query("DELETE FROM spaartrack.ledger_transaction_tag WHERE ledger_transaction_id = ANY($1::uuid[])", [transactionIds]);
      if (tagIds.length) await databasePool.query("INSERT INTO spaartrack.ledger_transaction_tag (ledger_transaction_id, tag_id) SELECT tx.value::uuid, tag.value::uuid FROM unnest($1::text[]) AS tx(value) CROSS JOIN unnest($2::text[]) AS tag(value) ON CONFLICT DO NOTHING", [transactionIds, tagIds]);
      await auditEvent(req, res, userId, "MONEY_FLOW_TRANSACTIONS_BULK_EDIT", "LEDGER_TRANSACTION", portfolioId, { portfolio_id: portfolioId, transaction_ids: transactionIds, payee_id: payeeId, tag_ids: tagIds, updated_count: transactionIds.length });
      json(res, 200, { portfolio_id: portfolioId, updated_count: transactionIds.length, transaction_ids: transactionIds, payee_id: payeeId, tag_ids: tagIds });
      return true;
    }
    if (path === "/api/v1/money-flow/payees-tags/assignments" && req.method === "GET") {
      const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) { json(res, 400, { error: "INVALID_PAYEE_TAG_ASSIGNMENT_QUERY" }); return true; }
      const access = await databasePool.query("SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL", [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
      const result = await databasePool.query("SELECT lt.id AS ledger_transaction_id, tc.payee_id, tc.classification_source, COALESCE(array_agg(ltt.tag_id) FILTER (WHERE ltt.tag_id IS NOT NULL), ARRAY[]::uuid[]) AS tag_ids FROM spaartrack.ledger_transaction lt LEFT JOIN spaartrack.transaction_category tc ON tc.ledger_transaction_id = lt.id LEFT JOIN spaartrack.ledger_transaction_tag ltt ON ltt.ledger_transaction_id = lt.id WHERE lt.portfolio_id = $1 GROUP BY lt.id, tc.payee_id, tc.classification_source ORDER BY lt.effective_date, lt.id", [portfolioId]);
      json(res, 200, { portfolio_id: portfolioId, assignments: result.rows, calculation_version: "money-flow-payees-tags-v1" });
      return true;
    }
    if (path.startsWith("/api/v1/money-flow/payees") || path.startsWith("/api/v1/money-flow/tags") || path.startsWith("/api/v1/money-flow/transactions/bulk-edit") || path.startsWith("/api/v1/money-flow/payees-tags")) { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "money_flow_payees_tags_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "MONEY_FLOW_PAYEE_TAG_REQUEST_FAILED" });
  }
  return true;
}

const moneyFlowRuleMatchTypes = ["CONTAINS", "STARTS_WITH", "EXACT", "REGEX"] as const;

function moneyFlowRuleResponse(row: Record<string, unknown>): Record<string, unknown> {
  return { id: row.id, user_id: row.user_id, name: row.name, priority: row.priority, is_active: row.is_active, account_id: row.account_id, conditions: row.conditions, actions: row.actions, review_required: row.review_required, last_executed_at: row.last_executed_at };
}

function moneyFlowRuleMatches(rule: Record<string, unknown>, description: string): boolean {
  const conditions = rule.conditions && typeof rule.conditions === "object" ? rule.conditions as Record<string, unknown> : {};
  const value = typeof conditions.value === "string" ? conditions.value : "";
  const matchType = String(conditions.match_type || "").toUpperCase();
  if (String(conditions.field || "description") !== "description" || !value) return false;
  if (matchType === "CONTAINS") return description.toLocaleLowerCase("en-US").includes(value.toLocaleLowerCase("en-US"));
  if (matchType === "STARTS_WITH") return description.toLocaleLowerCase("en-US").startsWith(value.toLocaleLowerCase("en-US"));
  if (matchType === "EXACT") return description === value;
  if (matchType === "REGEX") {
    try { return new RegExp(value, "i").test(description); } catch { return false; }
  }
  return false;
}

async function moneyFlowRulesRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/money-flow/rules")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const parsed = new URL(req.url, "http://localhost");
  const path = parsed.pathname;
  const ruleMatch = path.match(/^\/api\/v1\/money-flow\/rules\/([0-9a-f-]{36})$/i);
  try {
    if (path === "/api/v1/money-flow/rules" && req.method === "GET") {
      const result = await databasePool.query("SELECT id, user_id, name, priority, is_active, account_id, conditions, actions, review_required, last_executed_at FROM spaartrack.transaction_rule WHERE user_id = $1 ORDER BY priority, id", [userId]);
      json(res, 200, { rules: result.rows.map(moneyFlowRuleResponse), calculation_version: "money-flow-rules-v1" });
      return true;
    }
    if (path === "/api/v1/money-flow/rules" && req.method === "POST") {
      const body = await readJson(req);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const priority = Number.isInteger(body.priority) ? Number(body.priority) : 100;
      const accountId = body.account_id === null || body.account_id === undefined || body.account_id === "" ? null : typeof body.account_id === "string" ? body.account_id.trim() : "";
      const conditions = body.conditions && typeof body.conditions === "object" ? body.conditions as Record<string, unknown> : {};
      const actions = body.actions && typeof body.actions === "object" ? body.actions as Record<string, unknown> : {};
      const matchType = typeof conditions.match_type === "string" ? conditions.match_type.trim().toUpperCase() : "";
      const field = typeof conditions.field === "string" ? conditions.field.trim() : "description";
      const value = typeof conditions.value === "string" ? conditions.value.trim() : "";
      const reviewRequired = body.review_required === undefined ? false : body.review_required;
      if (!name || name.length > 120 || priority < 0 || priority > 1_000_000 || !moneyFlowRuleMatchTypes.includes(matchType as typeof moneyFlowRuleMatchTypes[number]) || field !== "description" || !value || value.length > 200 || (accountId !== null && !/^[0-9a-f-]{36}$/i.test(accountId)) || typeof reviewRequired !== "boolean") { json(res, 400, { error: "INVALID_MONEY_FLOW_RULE_INPUT" }); return true; }
      if (accountId) {
        const account = await databasePool.query("SELECT 1 FROM spaartrack.financial_account fa JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = fa.portfolio_id WHERE fa.id = $1 AND pm.user_id = $2 AND pm.revoked_at IS NULL", [accountId, userId]);
        if (!account.rowCount) { json(res, 404, { error: "RULE_ACCOUNT_NOT_FOUND" }); return true; }
      }
      const normalizedConditions = { match_type: matchType, field, value };
      const result = await databasePool.query("INSERT INTO spaartrack.transaction_rule (user_id, name, priority, account_id, conditions, actions, review_required) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, user_id, name, priority, is_active, account_id, conditions, actions, review_required, last_executed_at", [userId, name, priority, accountId, JSON.stringify(normalizedConditions), JSON.stringify(actions), reviewRequired]);
      await auditEvent(req, res, userId, "MONEY_FLOW_RULE_CREATE", "TRANSACTION_RULE", String(result.rows[0].id), { name, priority, account_id: accountId, conditions: normalizedConditions, actions });
      json(res, 201, moneyFlowRuleResponse(result.rows[0]));
      return true;
    }
    if (ruleMatch && req.method === "PATCH") {
      const body = await readJson(req);
      const current = await databasePool.query("SELECT id, user_id, name, priority, is_active, account_id, conditions, actions, review_required, last_executed_at FROM spaartrack.transaction_rule WHERE id = $1 AND user_id = $2", [ruleMatch[1], userId]);
      if (!current.rowCount) { json(res, 404, { error: "RULE_NOT_FOUND" }); return true; }
      const name = body.name === undefined ? String(current.rows[0].name) : typeof body.name === "string" ? body.name.trim() : "";
      const priority = body.priority === undefined ? Number(current.rows[0].priority) : Number.isInteger(body.priority) ? Number(body.priority) : -1;
      const isActive = body.is_active === undefined ? Boolean(current.rows[0].is_active) : body.is_active;
      if (!name || name.length > 120 || priority < 0 || priority > 1_000_000 || typeof isActive !== "boolean") { json(res, 400, { error: "INVALID_MONEY_FLOW_RULE_UPDATE" }); return true; }
      const result = await databasePool.query("UPDATE spaartrack.transaction_rule SET name = $2, priority = $3, is_active = $4 WHERE id = $1 AND user_id = $5 RETURNING id, user_id, name, priority, is_active, account_id, conditions, actions, review_required, last_executed_at", [ruleMatch[1], name, priority, isActive, userId]);
      await auditEvent(req, res, userId, "MONEY_FLOW_RULE_UPDATE", "TRANSACTION_RULE", ruleMatch[1], { name, priority, is_active: isActive });
      json(res, 200, moneyFlowRuleResponse(result.rows[0]));
      return true;
    }
    if (path === "/api/v1/money-flow/rules/apply" && req.method === "POST") {
      const body = await readJson(req);
      const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
      const transactionIds = Array.isArray(body.transaction_ids) ? [...new Set(body.transaction_ids.filter((value): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)))] : [];
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || transactionIds.length === 0 || transactionIds.length > 500) { json(res, 400, { error: "INVALID_MONEY_FLOW_RULE_APPLY" }); return true; }
      const access = await databasePool.query("SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL AND role IN ('OWNER', 'EDITOR')", [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
      const transactions = await databasePool.query("SELECT id, financial_account_id, description FROM spaartrack.ledger_transaction WHERE portfolio_id = $1 AND id = ANY($2::uuid[])", [portfolioId, transactionIds]);
      if (transactions.rowCount !== transactionIds.length) { json(res, 400, { error: "TRANSACTION_PORTFOLIO_MISMATCH" }); return true; }
      const rulesResult = await databasePool.query("SELECT id, name, priority, account_id, conditions, actions, review_required FROM spaartrack.transaction_rule WHERE user_id = $1 AND is_active = true ORDER BY priority, CASE UPPER(conditions->>'match_type') WHEN 'CONTAINS' THEN 1 WHEN 'STARTS_WITH' THEN 2 WHEN 'EXACT' THEN 3 WHEN 'REGEX' THEN 4 ELSE 99 END, id", [userId]);
      const matches: Array<Record<string, unknown>> = [];
      for (const transaction of transactions.rows) {
        const rule = rulesResult.rows.find((candidate) => (!candidate.account_id || String(candidate.account_id) === String(transaction.financial_account_id)) && moneyFlowRuleMatches(candidate, String(transaction.description || "")));
        if (!rule) continue;
        const actions = rule.actions && typeof rule.actions === "object" ? rule.actions as Record<string, unknown> : {};
        const categoryId = typeof actions.category_id === "string" ? actions.category_id : null;
        const payeeId = typeof actions.payee_id === "string" ? actions.payee_id : null;
        const tagIds = Array.isArray(actions.tag_ids) ? actions.tag_ids.filter((value): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)) : [];
        const confidence = typeof actions.confidence === "number" && actions.confidence >= 0 && actions.confidence <= 1 ? actions.confidence : rule.review_required ? 0.75 : 1;
        await databasePool.query("INSERT INTO spaartrack.transaction_category (ledger_transaction_id, category_id, payee_id, confidence, classification_source, reviewed_by, reviewed_at) VALUES ($1, $2, $3, $4, 'RULE', CASE WHEN $5::boolean THEN NULL ELSE $6::uuid END, CASE WHEN $5::boolean THEN NULL ELSE now() END) ON CONFLICT (ledger_transaction_id) DO UPDATE SET category_id = COALESCE(EXCLUDED.category_id, spaartrack.transaction_category.category_id), payee_id = COALESCE(EXCLUDED.payee_id, spaartrack.transaction_category.payee_id), confidence = EXCLUDED.confidence, classification_source = 'RULE', reviewed_by = EXCLUDED.reviewed_by, reviewed_at = EXCLUDED.reviewed_at", [transaction.id, categoryId, payeeId, confidence, Boolean(rule.review_required), userId]);
        await databasePool.query("DELETE FROM spaartrack.ledger_transaction_tag WHERE ledger_transaction_id = $1", [transaction.id]);
        if (tagIds.length) await databasePool.query("INSERT INTO spaartrack.ledger_transaction_tag (ledger_transaction_id, tag_id) SELECT $1, value::uuid FROM unnest($2::text[]) AS value ON CONFLICT DO NOTHING", [transaction.id, tagIds]);
        matches.push({ transaction_id: transaction.id, rule_id: rule.id, rule_name: rule.name, priority: rule.priority, match_type: (rule.conditions as Record<string, unknown>).match_type, review_required: Boolean(rule.review_required), confidence });
        await databasePool.query("UPDATE spaartrack.transaction_rule SET last_executed_at = now() WHERE id = $1", [rule.id]);
      }
      await auditEvent(req, res, userId, "MONEY_FLOW_RULES_APPLY", "TRANSACTION_RULE", portfolioId, { portfolio_id: portfolioId, transaction_ids: transactionIds, applied_count: matches.length, matches });
      json(res, 200, { portfolio_id: portfolioId, applied_count: matches.length, matches, calculation_version: "money-flow-rules-v1" });
      return true;
    }
    if (path.startsWith("/api/v1/money-flow/rules")) { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "money_flow_rules_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "MONEY_FLOW_RULE_REQUEST_FAILED" });
  }
  return true;
}

async function moneyFlowReviewRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/money-flow/review-queue")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const parsed = new URL(req.url, "http://localhost");
  const path = parsed.pathname;
  const transactionMatch = path.match(/^\/api\/v1\/money-flow\/review-queue\/([0-9a-f-]{36})$/i);
  try {
    if (path === "/api/v1/money-flow/review-queue" && req.method === "GET") {
      const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) { json(res, 400, { error: "INVALID_REVIEW_QUEUE_QUERY" }); return true; }
      const access = await databasePool.query("SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL", [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
      const result = await databasePool.query("SELECT lt.id AS transaction_id, lt.description, lt.effective_date::text, tc.category_id, tc.payee_id, tc.confidence::text, tc.classification_source, tc.reviewed_by, tc.reviewed_at FROM spaartrack.ledger_transaction lt JOIN spaartrack.transaction_category tc ON tc.ledger_transaction_id = lt.id WHERE lt.portfolio_id = $1 AND tc.reviewed_at IS NULL AND tc.classification_source IN ('RULE', 'IMPORT', 'AI') ORDER BY lt.effective_date, lt.id", [portfolioId]);
      json(res, 200, { portfolio_id: portfolioId, items: result.rows.map((row) => ({ ...row, status: row.reviewed_at ? "REVIEWED" : "PENDING" })), calculation_version: "money-flow-review-v1" });
      return true;
    }
    if (transactionMatch && req.method === "PATCH") {
      const body = await readJson(req);
      const action = typeof body.action === "string" ? body.action.trim().toUpperCase() : "";
      if (!["ACCEPT", "OVERRIDE", "REJECT"].includes(action)) { json(res, 400, { error: "INVALID_REVIEW_ACTION" }); return true; }
      const current = await databasePool.query("SELECT lt.id, lt.portfolio_id, tc.category_id, tc.payee_id, tc.classification_source FROM spaartrack.ledger_transaction lt JOIN spaartrack.transaction_category tc ON tc.ledger_transaction_id = lt.id JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = lt.portfolio_id WHERE lt.id = $1 AND pm.user_id = $2 AND pm.revoked_at IS NULL AND pm.role IN ('OWNER', 'EDITOR')", [transactionMatch[1], userId]);
      if (!current.rowCount) { json(res, 404, { error: "REVIEW_ITEM_NOT_FOUND" }); return true; }
      const currentRow = current.rows[0];
      let categoryId = currentRow.category_id;
      let payeeId = currentRow.payee_id;
      let tagIds: string[] = [];
      if (action === "OVERRIDE") {
        categoryId = typeof body.category_id === "string" && body.category_id.trim() ? body.category_id.trim() : null;
        payeeId = typeof body.payee_id === "string" && body.payee_id.trim() ? body.payee_id.trim() : null;
        tagIds = Array.isArray(body.tag_ids) ? [...new Set(body.tag_ids.filter((value): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)))] : [];
        if (categoryId) { const category = await databasePool.query("SELECT 1 FROM spaartrack.category WHERE id = $1 AND user_id = $2 AND is_active = true", [categoryId, userId]); if (!category.rowCount) { json(res, 404, { error: "REVIEW_CATEGORY_NOT_FOUND" }); return true; } }
        if (payeeId) { const payee = await databasePool.query("SELECT 1 FROM spaartrack.payee WHERE id = $1 AND user_id = $2 AND is_active = true", [payeeId, userId]); if (!payee.rowCount) { json(res, 404, { error: "REVIEW_PAYEE_NOT_FOUND" }); return true; } }
        if (tagIds.length) { const tags = await databasePool.query("SELECT id FROM spaartrack.transaction_tag WHERE id = ANY($1::uuid[]) AND user_id = $2", [tagIds, userId]); if (tags.rowCount !== tagIds.length) { json(res, 400, { error: "REVIEW_TAG_USER_MISMATCH" }); return true; } }
      }
      if (action === "REJECT") { categoryId = null; payeeId = null; }
      const source = action === "ACCEPT" ? currentRow.classification_source : "MANUAL";
      await databasePool.query("UPDATE spaartrack.transaction_category SET category_id = $2, payee_id = $3, confidence = CASE WHEN $4 = 'MANUAL' THEN 1 ELSE confidence END, classification_source = $4, reviewed_by = $5, reviewed_at = now() WHERE ledger_transaction_id = $1", [transactionMatch[1], categoryId, payeeId, source, userId]);
      if (action !== "ACCEPT") {
        await databasePool.query("DELETE FROM spaartrack.ledger_transaction_tag WHERE ledger_transaction_id = $1", [transactionMatch[1]]);
        if (tagIds.length) await databasePool.query("INSERT INTO spaartrack.ledger_transaction_tag (ledger_transaction_id, tag_id) SELECT $1, value::uuid FROM unnest($2::text[]) AS value ON CONFLICT DO NOTHING", [transactionMatch[1], tagIds]);
      }
      await auditEvent(req, res, userId, `MONEY_FLOW_REVIEW_${action}`, "LEDGER_TRANSACTION", transactionMatch[1], { action, previous_classification_source: currentRow.classification_source, category_id: categoryId, payee_id: payeeId, tag_ids: tagIds });
      json(res, 200, { transaction_id: transactionMatch[1], action, status: "REVIEWED", classification_source: source, category_id: categoryId, payee_id: payeeId });
      return true;
    }
    if (path.startsWith("/api/v1/money-flow/review-queue")) { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "money_flow_review_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "MONEY_FLOW_REVIEW_REQUEST_FAILED" });
  }
  return true;
}

async function moneyFlowCategoriesRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/money-flow/categories")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const parsed = new URL(req.url, "http://localhost");
  const path = parsed.pathname;
  const categoryMatch = path.match(/^\/api\/v1\/money-flow\/categories\/([0-9a-f-]{36})$/i);
  try {
    if (path === "/api/v1/money-flow/categories" && req.method === "GET") {
      const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
      if (portfolioId) {
        const access = await databasePool.query("SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL", [portfolioId, userId]);
        if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
      }
      const values: unknown[] = [userId];
      const type = parsed.searchParams.get("category_type")?.trim().toUpperCase() || "";
      const typeClause = type ? ` AND category_type = $${values.push(type)}` : "";
      const result = await databasePool.query(`SELECT id, user_id, parent_id, category_type, name, color, is_system, is_active FROM spaartrack.category WHERE user_id = $1${typeClause} ORDER BY parent_id NULLS FIRST, name`, values);
      json(res, 200, { categories: result.rows.map(moneyFlowCategoryResponse), calculation_version: "money-flow-categories-v1" });
      return true;
    }
    if (path === "/api/v1/money-flow/categories" && req.method === "POST") {
      const body = await readJson(req);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const categoryType = typeof body.category_type === "string" ? body.category_type.trim().toUpperCase() : "";
      const parentId = typeof body.parent_id === "string" && body.parent_id.trim() ? body.parent_id.trim() : null;
      const color = typeof body.color === "string" && body.color.trim() ? body.color.trim() : null;
      if (!name || name.length > 80 || !moneyFlowCategoryTypes.includes(categoryType as typeof moneyFlowCategoryTypes[number]) || (parentId && !/^[0-9a-f-]{36}$/i.test(parentId))) {
        json(res, 400, { error: "INVALID_MONEY_FLOW_CATEGORY_INPUT" }); return true;
      }
      if (parentId) {
        const parent = await databasePool.query("SELECT id, category_type, is_active FROM spaartrack.category WHERE id = $1 AND user_id = $2", [parentId, userId]);
        if (!parent.rowCount) { json(res, 400, { error: "CATEGORY_PARENT_NOT_FOUND" }); return true; }
        if (String(parent.rows[0].category_type) !== categoryType) { json(res, 400, { error: "CATEGORY_PARENT_TYPE_MISMATCH" }); return true; }
      }
      const result = await databasePool.query("INSERT INTO spaartrack.category (user_id, parent_id, category_type, name, color) VALUES ($1, $2, $3, $4, $5) RETURNING id, user_id, parent_id, category_type, name, color, is_system, is_active", [userId, parentId, categoryType, name, color]);
      await auditEvent(req, res, userId, "MONEY_FLOW_CATEGORY_CREATE", "CATEGORY", String(result.rows[0].id), { parent_id: parentId, category_type: categoryType, name });
      json(res, 201, moneyFlowCategoryResponse(result.rows[0]));
      return true;
    }
    if (categoryMatch && req.method === "PATCH") {
      const body = await readJson(req);
      const current = await databasePool.query("SELECT id, user_id, parent_id, category_type, name, color, is_system, is_active FROM spaartrack.category WHERE id = $1 AND user_id = $2", [categoryMatch[1], userId]);
      if (!current.rowCount) { json(res, 404, { error: "CATEGORY_NOT_FOUND" }); return true; }
      if (current.rows[0].is_system) { json(res, 409, { error: "SYSTEM_CATEGORY_IMMUTABLE" }); return true; }
      const name = body.name === undefined ? String(current.rows[0].name) : typeof body.name === "string" ? body.name.trim() : "";
      const isActive = body.is_active === undefined ? Boolean(current.rows[0].is_active) : body.is_active;
      const color = body.color === undefined ? current.rows[0].color : typeof body.color === "string" && body.color.trim() ? body.color.trim() : null;
      if (!name || name.length > 80 || typeof isActive !== "boolean") { json(res, 400, { error: "INVALID_MONEY_FLOW_CATEGORY_UPDATE" }); return true; }
      const result = await databasePool.query("UPDATE spaartrack.category SET name = $2, color = $3, is_active = $4 WHERE id = $1 AND user_id = $5 RETURNING id, user_id, parent_id, category_type, name, color, is_system, is_active", [categoryMatch[1], name, color, isActive, userId]);
      await auditEvent(req, res, userId, "MONEY_FLOW_CATEGORY_UPDATE", "CATEGORY", categoryMatch[1], { name, is_active: isActive });
      json(res, 200, moneyFlowCategoryResponse(result.rows[0]));
      return true;
    }
    if (path === "/api/v1/money-flow/categories/bulk-reassign" && req.method === "POST") {
      const body = await readJson(req);
      const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
      const categoryId = typeof body.category_id === "string" ? body.category_id.trim() : "";
      const transactionIds = Array.isArray(body.transaction_ids) ? body.transaction_ids.filter((value): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)) : [];
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^[0-9a-f-]{36}$/i.test(categoryId) || transactionIds.length === 0 || transactionIds.length > 500) { json(res, 400, { error: "INVALID_CATEGORY_REASSIGNMENT" }); return true; }
      const access = await databasePool.query("SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL AND role IN ('OWNER', 'EDITOR')", [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
      const category = await databasePool.query("SELECT id, is_active FROM spaartrack.category WHERE id = $1 AND user_id = $2", [categoryId, userId]);
      if (!category.rowCount) { json(res, 404, { error: "CATEGORY_NOT_FOUND" }); return true; }
      if (!category.rows[0].is_active) { json(res, 409, { error: "CATEGORY_INACTIVE" }); return true; }
      const transactionCheck = await databasePool.query("SELECT id FROM spaartrack.ledger_transaction WHERE portfolio_id = $1 AND id = ANY($2::uuid[])", [portfolioId, transactionIds]);
      if (transactionCheck.rowCount !== transactionIds.length) { json(res, 400, { error: "TRANSACTION_PORTFOLIO_MISMATCH" }); return true; }
      const result = await databasePool.query(
        `INSERT INTO spaartrack.transaction_category (ledger_transaction_id, category_id, classification_source, reviewed_by, reviewed_at)
         SELECT value::uuid, $2, 'MANUAL', $3, now() FROM unnest($1::text[]) AS value
         ON CONFLICT (ledger_transaction_id) DO UPDATE SET category_id = EXCLUDED.category_id, classification_source = 'MANUAL', reviewed_by = EXCLUDED.reviewed_by, reviewed_at = now()`,
        [transactionIds, categoryId, userId]
      );
      await auditEvent(req, res, userId, "MONEY_FLOW_CATEGORY_BULK_REASSIGN", "CATEGORY", categoryId, { portfolio_id: portfolioId, transaction_ids: transactionIds, updated_count: result.rowCount });
      json(res, 200, { category_id: categoryId, updated_count: result.rowCount, transaction_ids: transactionIds });
      return true;
    }
    if (path === "/api/v1/money-flow/categories/assignments" && req.method === "GET") {
      const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) { json(res, 400, { error: "INVALID_CATEGORY_ASSIGNMENT_QUERY" }); return true; }
      const access = await databasePool.query("SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL", [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
      const result = await databasePool.query("SELECT tc.ledger_transaction_id, tc.category_id, tc.classification_source, tc.reviewed_at FROM spaartrack.transaction_category tc JOIN spaartrack.ledger_transaction lt ON lt.id = tc.ledger_transaction_id WHERE lt.portfolio_id = $1 ORDER BY tc.reviewed_at DESC", [portfolioId]);
      json(res, 200, { portfolio_id: portfolioId, assignments: result.rows, calculation_version: "money-flow-category-assignments-v1" });
      return true;
    }
    if (path.startsWith("/api/v1/money-flow/categories")) { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "money_flow_categories_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "MONEY_FLOW_CATEGORY_REQUEST_FAILED" });
  }
  return true;
}

function moneyFlowBudgetLineResponse(row: Record<string, unknown>): Record<string, unknown> {
  const planned = Number(row.planned_amount || 0);
  const rollover = Number(row.rollover_amount || 0);
  const actual = Number(row.actual_amount || 0);
  return {
    id: row.id,
    category_id: row.category_id,
    category_name: row.category_name,
    currency_code: row.currency_code,
    planned_amount: fixedAmount(planned),
    rollover_amount: fixedAmount(rollover),
    actual_amount: fixedAmount(actual),
    variance_amount: fixedAmount(planned + rollover - actual),
    status: actual > planned + rollover ? "OVER_BUDGET" : "WITHIN_BUDGET"
  };
}

async function moneyFlowBudgetsRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/money-flow/budgets")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const parsed = new URL(req.url, "http://localhost");
  let portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
  let periodStart = parsed.searchParams.get("period_start")?.trim() || "";
  let periodEnd = parsed.searchParams.get("period_end")?.trim() || "";
  let requestBody: Record<string, unknown> = {};
  if (req.method === "POST") {
    requestBody = await readJson(req);
    portfolioId = typeof requestBody.portfolio_id === "string" ? requestBody.portfolio_id.trim() : "";
    periodStart = typeof requestBody.period_start === "string" ? requestBody.period_start.trim() : "";
    periodEnd = typeof requestBody.period_end === "string" ? requestBody.period_end.trim() : "";
  }
  const validPeriod = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(periodStart) && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(periodEnd) && periodStart <= periodEnd;
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !validPeriod) { json(res, 400, { error: "INVALID_MONEY_FLOW_BUDGET_QUERY" }); return true; }
  const access = await databasePool.query("SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL", [portfolioId, userId]);
  if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }

  const buildResponse = async (planId: string): Promise<Record<string, unknown>> => {
    const result = await databasePool.query(
      `SELECT bp.id, bp.portfolio_id, bp.period_start::text, bp.period_end::text, bp.rollover_enabled,
              bg.id AS group_id, bg.name AS group_name, bg.sort_order,
              bl.id AS line_id, bl.category_id, c.name AS category_name, bl.planned_amount::text,
              bl.rollover_amount::text, bl.currency_code,
              COALESCE((SELECT SUM(CASE WHEN le.direction = 'DEBIT' THEN le.amount + COALESCE(le.fee_amount, 0) + COALESCE(le.tax_amount, 0) ELSE 0 END)
                        FROM spaartrack.ledger_transaction lt
                        JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id AND le.entry_kind = 'CASH'
                        JOIN spaartrack.transaction_category tc ON tc.ledger_transaction_id = lt.id
                        WHERE lt.portfolio_id = bp.portfolio_id AND lt.state = 'POSTED'
                          AND lt.effective_date BETWEEN bp.period_start AND bp.period_end
                          AND tc.category_id = bl.category_id), 0)::text AS actual_amount
       FROM spaartrack.budget_plan bp
       LEFT JOIN spaartrack.budget_group bg ON bg.budget_plan_id = bp.id
       LEFT JOIN spaartrack.budget_line bl ON bl.budget_plan_id = bp.id AND bl.budget_group_id = bg.id
       LEFT JOIN spaartrack.category c ON c.id = bl.category_id
       WHERE bp.id = $1 AND bp.user_id = $2
       ORDER BY bg.sort_order, bg.name, c.name`, [planId, userId]);
    const first = result.rows[0];
    const groups = new Map<string, { id: unknown; name: unknown; lines: Record<string, unknown>[] }>();
    for (const row of result.rows) {
      const key = String(row.group_id || "ungrouped");
      if (!groups.has(key)) groups.set(key, { id: row.group_id, name: row.group_name || "Ungrouped", lines: [] });
      if (row.line_id) groups.get(key)?.lines.push(moneyFlowBudgetLineResponse({ ...row, id: row.line_id }));
    }
    return {
      id: first?.id || planId, portfolio_id: portfolioId, period_start: first?.period_start || periodStart,
      period_end: first?.period_end || periodEnd, rollover_enabled: Boolean(first?.rollover_enabled),
      groups: [...groups.values()], calculation_version: "money-flow-budgets-v1"
    };
  };

  try {
    if (req.method === "GET") {
      const plans = await databasePool.query("SELECT id FROM spaartrack.budget_plan WHERE user_id = $1 AND portfolio_id = $2 AND period_start = $3 AND period_end = $4 ORDER BY period_start DESC", [userId, portfolioId, periodStart, periodEnd]);
      json(res, 200, { portfolio_id: portfolioId, budgets: await Promise.all(plans.rows.map((row) => buildResponse(String(row.id))),), calculation_version: "money-flow-budgets-v1" });
      return true;
    }
    if (req.method !== "POST") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
    const body = requestBody;
    const rolloverEnabled = body.rollover_enabled === true;
    const groups = Array.isArray(body.groups) ? body.groups : [];
    if (!groups.length || groups.length > 100) { json(res, 400, { error: "INVALID_MONEY_FLOW_BUDGET_GROUPS" }); return true; }
    const client = await databasePool.connect();
    try {
      await client.query("BEGIN");
      const plan = await client.query("INSERT INTO spaartrack.budget_plan (user_id, portfolio_id, period_start, period_end, rollover_enabled) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, portfolio_id, period_start, period_end) DO UPDATE SET rollover_enabled = EXCLUDED.rollover_enabled RETURNING id", [userId, portfolioId, periodStart, periodEnd, rolloverEnabled]);
      const planId = String(plan.rows[0].id);
      for (const [groupIndex, group] of groups.entries()) {
        const name = typeof group?.name === "string" ? group.name.trim() : "";
        const lines = Array.isArray(group?.lines) ? group.lines : [];
        if (!name || name.length > 100 || !lines.length) throw new Error("INVALID_MONEY_FLOW_BUDGET_GROUP");
        const groupResult = await client.query("INSERT INTO spaartrack.budget_group (budget_plan_id, name, sort_order) VALUES ($1, $2, $3) ON CONFLICT (budget_plan_id, name) DO UPDATE SET sort_order = EXCLUDED.sort_order RETURNING id", [planId, name, groupIndex]);
        for (const line of lines) {
          const categoryId = typeof line?.category_id === "string" ? line.category_id.trim() : "";
          const planned = typeof line?.planned_amount === "string" || typeof line?.planned_amount === "number" ? String(line.planned_amount) : "";
          const rollover = typeof line?.rollover_amount === "string" || typeof line?.rollover_amount === "number" ? String(line.rollover_amount) : "0";
          const currency = typeof line?.currency_code === "string" ? line.currency_code.trim().toUpperCase() : "";
          if (!/^[0-9a-f-]{36}$/i.test(categoryId) || !/^\d+(\.\d+)?$/.test(planned) || !/^\d+(\.\d+)?$/.test(rollover) || !/^[A-Z]{3}$/.test(currency)) throw new Error("INVALID_MONEY_FLOW_BUDGET_LINE");
          await client.query("INSERT INTO spaartrack.budget_line (budget_plan_id, budget_group_id, category_id, planned_amount, rollover_amount, currency_code) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (budget_plan_id, category_id) DO UPDATE SET budget_group_id = EXCLUDED.budget_group_id, planned_amount = EXCLUDED.planned_amount, rollover_amount = EXCLUDED.rollover_amount, currency_code = EXCLUDED.currency_code", [planId, groupResult.rows[0].id, categoryId, planned, rollover, currency]);
        }
      }
      await client.query("COMMIT");
      const response = await buildResponse(planId);
      await auditEvent(req, res, userId, "MONEY_FLOW_BUDGET_UPSERT", "BUDGET_PLAN", planId, { portfolio_id: portfolioId, period_start: periodStart, period_end: periodEnd, group_count: groups.length });
      json(res, 201, response);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(redactedLog({ level: "error", operation: "money_flow_budget_failed", error: (error as Error).message }));
      json(res, 400, { error: "INVALID_MONEY_FLOW_BUDGET_REQUEST" });
    } finally { client.release(); }
    return true;
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "money_flow_budget_failed", error: (error as Error).message }));
    json(res, 400, { error: "MONEY_FLOW_BUDGET_REQUEST_FAILED" });
    return true;
  }
}

async function moneyFlowActivitiesRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }
  if (req.method !== "GET" || !req.url?.startsWith("/api/v1/money-flow/activities")) return false;
  const url = new URL(req.url, "http://localhost");
  const portfolioId = url.searchParams.get("portfolio_id")?.trim() || "";
  const periodStart = url.searchParams.get("period_start")?.trim() || "1900-01-01";
  const periodEnd = url.searchParams.get("period_end")?.trim() || "2999-12-31";
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) {
    json(res, 400, { error: "INVALID_MONEY_FLOW_ACTIVITY_QUERY" });
    return true;
  }
  const access = await databasePool.query(
    `SELECT 1 FROM spaartrack.portfolio_member
     WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [portfolioId, userId]
  );
  if (!access.rowCount) {
    json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
    return true;
  }
  const rows = await databasePool.query(
    `SELECT lt.id, lt.portfolio_id, lt.financial_account_id, fa.name AS account_name,
            lt.activity_type, lt.effective_date::text, lt.occurred_at::text,
            lt.description, lt.paired_transaction_id, lt.is_external_flow,
            le.direction, le.amount::text, le.currency_code,
            le.fee_amount::text, le.tax_amount::text
     FROM spaartrack.ledger_transaction lt
     JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
     JOIN spaartrack.financial_account fa ON fa.id = lt.financial_account_id
     JOIN spaartrack.money_flow_account_scope mas
       ON mas.portfolio_id = lt.portfolio_id AND mas.user_id = $2
      AND mas.financial_account_id = lt.financial_account_id AND mas.is_enabled = true
     WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED'
       AND lt.effective_date BETWEEN $3::date AND $4::date
       AND le.entry_kind = 'CASH'
     ORDER BY lt.effective_date, lt.occurred_at, lt.id`,
    [portfolioId, userId, periodStart, periodEnd]
  );
  const totals: Record<string, number> = { INCOME: 0, SAVING: 0, SPENDING: 0, TRANSFER: 0 };
  const activities = rows.rows.map((row) => {
    const amount = Number(row.amount || 0);
    const fee = Number(row.fee_amount || 0);
    const tax = Number(row.tax_amount || 0);
    const finalAmount = row.direction === "DEBIT" ? amount + fee + tax : Math.max(0, amount - fee - tax);
    const signedFinalAmount = row.direction === "DEBIT" ? -finalAmount : finalAmount;
    const categoryType = moneyFlowCategory(String(row.activity_type));
    const isContributionNeutral = moneyFlowNeutralActivities.has(String(row.activity_type));
    if (!isContributionNeutral) totals[categoryType] += signedFinalAmount;
    return {
      id: row.id,
      portfolio_id: row.portfolio_id,
      financial_account_id: row.financial_account_id,
      account_name: row.account_name,
      activity_type: row.activity_type,
      category_type: categoryType,
      effective_date: row.effective_date,
      occurred_at: row.occurred_at,
      description: row.description,
      paired_transaction_id: row.paired_transaction_id,
      is_external_flow: row.is_external_flow,
      is_contribution_neutral: isContributionNeutral,
      neutral_reason: isContributionNeutral
        ? row.activity_type === "LIABILITY_PAYMENT" ? "CREDIT_CARD_PAYMENT" : "PAIRED_INTERNAL_TRANSFER"
        : null,
      direction: row.direction,
      amount: fixedAmount(amount),
      fee_amount: fixedAmount(fee),
      tax_amount: fixedAmount(tax),
      final_amount: fixedAmount(finalAmount),
      signed_final_amount: fixedAmount(signedFinalAmount),
      currency_code: row.currency_code
    };
  });
  json(res, 200, {
    portfolio_id: portfolioId,
    period_start: periodStart,
    period_end: periodEnd,
    calculation_version: "money-flow-activities-v1",
    activities,
    totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, fixedAmount(value)]))
  });
  return true;
}

function moneyFlowAnalysisTransaction(row: Record<string, unknown>): Record<string, unknown> {
  const amount = Number(row.amount || 0);
  const fee = Number(row.fee_amount || 0);
  const tax = Number(row.tax_amount || 0);
  const finalAmount = row.direction === "DEBIT" ? amount + fee + tax : Math.max(0, amount - fee - tax);
  const signedAmount = row.direction === "DEBIT" ? -finalAmount : finalAmount;
  return {
    id: row.id,
    category_id: row.category_id,
    category_name: row.category_name || "Uncategorized",
    category_type: row.category_type,
    effective_date: row.effective_date,
    description: row.description,
    amount: fixedAmount(finalAmount),
    signed_amount: fixedAmount(signedAmount),
    currency_code: row.currency_code
  };
}

async function moneyFlowCurrencyReportRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/money-flow/currency-report")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const parsed = new URL(req.url, "http://localhost");
  const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
  const baseCurrency = parsed.searchParams.get("base_currency_code")?.trim().toUpperCase() || "";
  const periodStart = parsed.searchParams.get("period_start")?.trim() || "1900-01-01";
  const periodEnd = parsed.searchParams.get("period_end")?.trim() || "2999-12-31";
  if (req.method !== "GET" || !/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^[A-Z]{3}$/.test(baseCurrency) || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) {
    json(res, 400, { error: "INVALID_MONEY_FLOW_CURRENCY_REPORT_QUERY" }); return true;
  }
  const access = await databasePool.query("SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL", [portfolioId, userId]);
  if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
  const currency = await databasePool.query("SELECT 1 FROM spaartrack.currency WHERE code = $1", [baseCurrency]);
  if (!currency.rowCount) { json(res, 400, { error: "UNKNOWN_BASE_CURRENCY" }); return true; }
  const rows = await databasePool.query(
    `SELECT lt.id, lt.effective_date::text, lt.description, le.direction,
            le.amount::text, le.fee_amount::text, le.tax_amount::text, le.currency_code,
            tc.category_id, c.name AS category_name
     FROM spaartrack.ledger_transaction lt
     JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id AND le.entry_kind = 'CASH'
     JOIN spaartrack.money_flow_account_scope mas
       ON mas.portfolio_id = lt.portfolio_id AND mas.user_id = $2
      AND mas.financial_account_id = lt.financial_account_id AND mas.is_enabled = true
     LEFT JOIN spaartrack.transaction_category tc ON tc.ledger_transaction_id = lt.id
     LEFT JOIN spaartrack.category c ON c.id = tc.category_id
     WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED'
       AND lt.effective_date BETWEEN $3::date AND $4::date
     ORDER BY lt.effective_date, lt.id`, [portfolioId, userId, periodStart, periodEnd]);
  const nativeCurrencies = [...new Set(rows.rows.map((row) => String(row.currency_code).trim()))];
  const periodEndFx: Record<string, unknown>[] = [];
  const rates = new Map<string, number>();
  for (const nativeCurrency of nativeCurrencies) {
    if (nativeCurrency === baseCurrency) {
      rates.set(nativeCurrency, 1);
      periodEndFx.push({ native_currency_code: nativeCurrency, base_currency_code: baseCurrency, rate: "1.0000000000000000", rate_at: `${periodEnd}T23:59:59.000Z`, source: "SYSTEM", source_version: "identity" });
      continue;
    }
    const fx = await databasePool.query(
      `SELECT base_currency_code, quote_currency_code, rate_at, rate::text, source, source_version
       FROM spaartrack.fx_rate
       WHERE base_currency_code = $1 AND quote_currency_code = $2
         AND rate_at <= ($3::date + interval '1 day' - interval '1 second')
       ORDER BY rate_at DESC, captured_at DESC, source, source_version LIMIT 1`, [nativeCurrency, baseCurrency, periodEnd]);
    if (!fx.rowCount) { json(res, 422, { error: "MISSING_PERIOD_END_FX", native_currency_code: nativeCurrency, base_currency_code: baseCurrency }); return true; }
    const rate = Number(fx.rows[0].rate);
    rates.set(nativeCurrency, rate);
    periodEndFx.push({ native_currency_code: nativeCurrency, base_currency_code: baseCurrency, rate: fx.rows[0].rate, rate_at: new Date(fx.rows[0].rate_at).toISOString(), source: fx.rows[0].source, source_version: fx.rows[0].source_version });
  }
  const totalsByCurrency = new Map<string, number>();
  let baseTotal = 0;
  const activities = rows.rows.map((row) => {
    const amount = Number(row.amount || 0);
    const fee = Number(row.fee_amount || 0);
    const tax = Number(row.tax_amount || 0);
    const finalAmount = row.direction === "DEBIT" ? amount + fee + tax : Math.max(0, amount - fee - tax);
    const nativeAmount = row.direction === "DEBIT" ? -finalAmount : finalAmount;
    const nativeCurrency = String(row.currency_code).trim();
    const baseAmount = nativeAmount * (rates.get(nativeCurrency) || 0);
    totalsByCurrency.set(nativeCurrency, (totalsByCurrency.get(nativeCurrency) || 0) + nativeAmount);
    baseTotal += baseAmount;
    return { id: row.id, effective_date: row.effective_date, description: row.description, category_id: row.category_id, category_name: row.category_name || "Uncategorized", native_amount: fixedAmount(nativeAmount), native_currency_code: nativeCurrency, base_amount: fixedAmount(baseAmount), base_currency_code: baseCurrency, fx_rate: String(rates.get(nativeCurrency)), period_end_fx: true };
  });
  json(res, 200, {
    portfolio_id: portfolioId, period_start: periodStart, period_end: periodEnd, base_currency_code: baseCurrency,
    period_end_fx: periodEndFx,
    totals: { native: [...totalsByCurrency.entries()].map(([currency_code, amount]) => ({ currency_code, amount: fixedAmount(amount) })), base_amount: fixedAmount(baseTotal), base_currency_code: baseCurrency },
    activities, calculation_version: "money-flow-currency-report-v1"
  });
  return true;
}

async function moneyFlowAnalysisRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/money-flow/analysis")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const parsed = new URL(req.url, "http://localhost");
  const isDrilldown = parsed.pathname === "/api/v1/money-flow/analysis/drilldown";
  const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
  const categoryId = parsed.searchParams.get("category_id")?.trim() || "";
  const accountId = parsed.searchParams.get("financial_account_id")?.trim() || "";
  const periodStart = parsed.searchParams.get("period_start")?.trim() || "1900-01-01";
  const periodEnd = parsed.searchParams.get("period_end")?.trim() || "2999-12-31";
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || (isDrilldown && !/^[0-9a-f-]{36}$/i.test(categoryId)) || (accountId && !/^[0-9a-f-]{36}$/i.test(accountId)) || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) {
    json(res, 400, { error: "INVALID_MONEY_FLOW_ANALYSIS_QUERY" }); return true;
  }
  const access = await databasePool.query("SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL", [portfolioId, userId]);
  if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
  const values: unknown[] = [portfolioId, userId, periodStart, periodEnd];
  const accountClause = accountId ? ` AND lt.financial_account_id = $${values.push(accountId)}` : "";
  const categoryClause = isDrilldown ? ` AND tc.category_id = $${values.push(categoryId)}` : "";
  const rows = await databasePool.query(
    `SELECT lt.id, lt.activity_type, lt.effective_date::text, lt.description, le.direction,
            le.amount::text, le.fee_amount::text, le.tax_amount::text, le.currency_code,
            tc.category_id, c.name AS category_name, c.category_type,
            c.parent_id, pc.name AS parent_name, pc.category_type AS parent_category_type
     FROM spaartrack.ledger_transaction lt
     JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id AND le.entry_kind = 'CASH'
     JOIN spaartrack.money_flow_account_scope mas
       ON mas.portfolio_id = lt.portfolio_id AND mas.user_id = $2
      AND mas.financial_account_id = lt.financial_account_id AND mas.is_enabled = true
     LEFT JOIN spaartrack.transaction_category tc ON tc.ledger_transaction_id = lt.id
     LEFT JOIN spaartrack.category c ON c.id = tc.category_id
     LEFT JOIN spaartrack.category pc ON pc.id = c.parent_id
     WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED'
       AND lt.effective_date BETWEEN $3::date AND $4::date${accountClause}${categoryClause}
     ORDER BY lt.effective_date, lt.id`, values);
  const transactions = rows.rows.map((row) => {
    const type = moneyFlowCategory(String(row.activity_type));
    return moneyFlowAnalysisTransaction({ ...row, category_type: row.category_type || type });
  });
  if (isDrilldown) {
    json(res, 200, { portfolio_id: portfolioId, category_id: categoryId, period_start: periodStart, period_end: periodEnd, transactions, calculation_version: "money-flow-analysis-v1" });
    return true;
  }
  const totals: Record<string, number> = { INCOME: 0, SAVING: 0, SPENDING: 0, TRANSFER: 0 };
  type AnalysisNode = { id: string | null; name: string; category_type: string; parent_id: string | null; total: number; transactions: Record<string, unknown>[]; children: AnalysisNode[] };
  const nodes = new Map<string, AnalysisNode>();
  for (const [index, transaction] of transactions.entries()) {
    const row = rows.rows[index];
    const type = String(transaction.category_type);
    if (row.parent_id && !nodes.has(String(row.parent_id))) nodes.set(String(row.parent_id), { id: String(row.parent_id), name: String(row.parent_name || row.parent_id), category_type: String(row.parent_category_type || type), parent_id: null, total: 0, transactions: [], children: [] });
    const signed = Number(transaction.signed_amount);
    if (type in totals) totals[type] += signed;
    const id = row.category_id ? String(row.category_id) : `${type}:uncategorized`;
    if (!nodes.has(id)) nodes.set(id, { id: row.category_id ? String(row.category_id) : null, name: String(row.category_name || "Uncategorized"), category_type: type, parent_id: row.parent_id ? String(row.parent_id) : null, total: 0, transactions: [], children: [] });
    const node = nodes.get(id)!;
    node.total += signed;
    node.transactions.push(transaction);
  }
  for (const node of nodes.values()) if (node.parent_id && nodes.has(node.parent_id)) nodes.get(node.parent_id)!.children.push(node);
  const flowTypes = ["INCOME", "SAVING", "SPENDING", "TRANSFER"];
  const flows = flowTypes.map((categoryType) => {
    const categories = [...nodes.values()].filter((node) => {
      return node.category_type === categoryType && !node.parent_id;
    });
    const addChildren = (node: AnalysisNode): void => { node.children.forEach(addChildren); node.total += node.children.reduce((sum, child) => sum + child.total, 0); };
    categories.forEach(addChildren);
    return { category_type: categoryType, total: fixedAmount(totals[categoryType]), categories: categories.map((node) => ({ ...node, total: fixedAmount(node.total), children: node.children.map((child) => ({ ...child, total: fixedAmount(child.total) })) })) };
  });
  json(res, 200, { portfolio_id: portfolioId, period_start: periodStart, period_end: periodEnd, account_scope: accountId || "ALL_ENABLED", totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, fixedAmount(value)])), flows, calculation_version: "money-flow-analysis-v1" });
  return true;
}

function instrumentResponse(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    instrument_type: row.instrument_type,
    asset_class: row.asset_class,
    name: row.name,
    short_name: row.short_name,
    currency_code: row.currency_code,
    exchange_id: row.exchange_id,
    exchange: row.exchange,
    ticker: row.ticker,
    isin: row.isin,
    cusip: row.cusip,
    is_listed: row.is_listed,
    is_active: row.is_active,
    valuation_source: row.valuation_source,
    metadata: row.metadata,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function instrumentRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }

  const instrumentMatch = req.url?.match(/^\/api\/v1\/instruments\/([0-9a-f-]+)$/i);
  if (req.method === "GET" && instrumentMatch) {
    const result = await databasePool.query(
      `SELECT i.id, i.instrument_type, i.asset_class, i.name, i.short_name, i.currency_code,
              i.exchange_id, e.mic AS exchange, i.ticker, i.isin, i.cusip, i.is_listed,
              i.is_active, i.valuation_source, i.metadata, i.created_at, i.updated_at
       FROM spaartrack.instrument i
       LEFT JOIN spaartrack.exchange e ON e.id = i.exchange_id
       WHERE i.id = $1`,
      [instrumentMatch[1]]
    );
    if (!result.rowCount) {
      json(res, 404, { error: "INSTRUMENT_NOT_FOUND" });
      return true;
    }
    json(res, 200, instrumentResponse(result.rows[0]));
    return true;
  }

  if (req.method === "POST" && req.url === "/api/v1/instruments") {
    const client = await databasePool.connect();
    try {
      const body = await readJson(req);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const instrumentType = typeof body.instrument_type === "string" ? body.instrument_type.trim().toUpperCase() : "";
      const assetClass = typeof body.asset_class === "string" ? body.asset_class.trim().toUpperCase() : "";
      const currencyCode = typeof body.currency_code === "string" ? body.currency_code.trim().toUpperCase() : "EUR";
      const ticker = typeof body.ticker === "string" ? body.ticker.trim().toUpperCase() : null;
      const isin = typeof body.isin === "string" ? body.isin.trim().toUpperCase() : null;
      const cusip = typeof body.cusip === "string" ? body.cusip.trim().toUpperCase() : null;
      const exchange = typeof body.exchange === "string" ? body.exchange.trim().toUpperCase() : null;
      const valuationSource = typeof body.valuation_source === "string" ? body.valuation_source.trim().toUpperCase() : "MANUAL";
      const isListed = typeof body.is_listed === "boolean" ? body.is_listed : true;
      if (!name || !instrumentTypes.includes(instrumentType as typeof instrumentTypes[number]) ||
          !assetClasses.includes(assetClass as typeof assetClasses[number]) || !/^[A-Z]{3}$/.test(currencyCode) ||
          !valuationSources.includes(valuationSource as typeof valuationSources[number]) ||
          (ticker !== null && !ticker) || (isin !== null && !isin) || (cusip !== null && !cusip) ||
          (exchange !== null && !/^[A-Z0-9._-]{2,12}$/.test(exchange))) {
        json(res, 400, { error: "INVALID_INSTRUMENT_INPUT" });
        return true;
      }

      await client.query("BEGIN");
      let exchangeId: string | null = typeof body.exchange_id === "string" ? body.exchange_id : null;
      if (exchange) {
        const exchangeResult = await client.query(
          `INSERT INTO spaartrack.exchange (mic, name, currency_code)
           VALUES ($1, $1, $2)
           ON CONFLICT (mic) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [exchange, currencyCode]
        );
        exchangeId = String(exchangeResult.rows[0].id);
      }
      const result = await client.query(
        `INSERT INTO spaartrack.instrument
           (instrument_type, asset_class, name, currency_code, exchange_id, ticker, isin, cusip, is_listed, valuation_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (isin) WHERE isin IS NOT NULL DO NOTHING
         RETURNING id, instrument_type, asset_class, name, short_name, currency_code, exchange_id,
                   ticker, isin, cusip, is_listed, is_active, valuation_source, metadata, created_at, updated_at`,
        [instrumentType, assetClass, name, currencyCode, exchangeId, ticker, isin, cusip, isListed, valuationSource]
      );
      if (!result.rowCount) {
        await client.query("ROLLBACK");
        json(res, 409, { error: "INSTRUMENT_IDENTIFIER_ALREADY_EXISTS" });
        return true;
      }
      await client.query("COMMIT");
      const response = result.rows[0] as Record<string, unknown>;
      response.exchange = exchange;
      json(res, 201, instrumentResponse(response));
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if ((error as { code?: string }).code === "23505") {
        json(res, 409, { error: "INSTRUMENT_IDENTIFIER_ALREADY_EXISTS" });
      } else if ((error as { code?: string }).code === "23503") {
        json(res, 400, { error: "INVALID_INSTRUMENT_REFERENCE" });
      } else {
        json(res, 400, { error: "INVALID_INSTRUMENT_REQUEST" });
      }
    } finally {
      client.release();
    }
    return true;
  }
  return false;
}

function fixedAmount(value: number): string {
  return value.toFixed(12);
}

async function taxLotsRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }
  if (req.method !== "GET" || !req.url?.startsWith("/api/v1/tax-lots")) return false;
  const url = new URL(req.url, "http://localhost");
  const portfolioId = url.searchParams.get("portfolio_id")?.trim() || "";
  const instrumentId = url.searchParams.get("instrument_id")?.trim() || "";
  const asOf = url.searchParams.get("as_of")?.trim() || new Date().toISOString().slice(0, 10);
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^[0-9a-f-]{36}$/i.test(instrumentId) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    json(res, 400, { error: "INVALID_TAX_LOT_QUERY" });
    return true;
  }
  const access = await databasePool.query(
    `SELECT 1 FROM spaartrack.portfolio_member
     WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [portfolioId, userId]
  );
  if (!access.rowCount) {
    json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
    return true;
  }
  const rows = await databasePool.query(
    `SELECT lt.id, lt.activity_type, lt.effective_date::text, lt.occurred_at,
            le.quantity::text, le.amount::text, le.fee_amount::text, le.tax_amount::text,
            le.currency_code
     FROM spaartrack.ledger_transaction lt
     JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
     WHERE lt.portfolio_id = $1 AND le.instrument_id = $2
       AND le.entry_kind = 'POSITION' AND lt.state = 'POSTED'
       AND lt.effective_date <= $3::date
     ORDER BY lt.effective_date, lt.occurred_at, lt.id`,
    [portfolioId, instrumentId, asOf]
  );
  const calculation = buildTaxLots({
    asOf,
    transactions: (rows.rows as Array<Record<string, string>>).map((row) => ({
      id: String(row.id), activityType: String(row.activity_type), effectiveDate: String(row.effective_date), occurredAt: String(row.occurred_at),
      quantity: Number(row.quantity || 0), amount: Number(row.amount || 0), fee: Number(row.fee_amount || 0), tax: Number(row.tax_amount || 0), currency: String(row.currency_code).trim().toUpperCase()
    }))
  });
  await auditEvent(req, res, userId, "CALCULATE", "TAX_LOTS", instrumentId, { portfolio_id: portfolioId, instrument_id: instrumentId, as_of: asOf, calculation_version: calculation.calculation_version, lot_count: calculation.lots.length });
  json(res, 200, { portfolio_id: portfolioId, instrument_id: instrumentId, ...calculation });
  return true;
}

async function taxLotMethodsRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET" || !req.url?.startsWith("/api/v1/tax-lot-methods")) return false;
  const url = new URL(req.url, "http://localhost");
  const portfolioId = url.searchParams.get("portfolio_id")?.trim() || "";
  const instrumentId = url.searchParams.get("instrument_id")?.trim() || "";
  const asOf = url.searchParams.get("as_of")?.trim() || new Date().toISOString().slice(0, 10);
  const method = (url.searchParams.get("method")?.trim().toUpperCase() || "ALL") as TaxLotMethod | "ALL";
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^[0-9a-f-]{36}$/i.test(instrumentId) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) { json(res, 400, { error: "INVALID_TAX_LOT_METHOD_QUERY" }); return true; }
  if (!["ALL", "FIFO", "LIFO", "WAC", "HIFO", "SPECIFIC_ID"].includes(method)) { json(res, 400, { error: "INVALID_TAX_LOT_METHOD" }); return true; }
  const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
  if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
  const rows = await databasePool.query(`SELECT lt.id, lt.activity_type, lt.effective_date::text, lt.occurred_at, le.quantity::text, le.amount::text, le.fee_amount::text, le.tax_amount::text, le.currency_code FROM spaartrack.ledger_transaction lt JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id WHERE lt.portfolio_id = $1 AND le.instrument_id = $2 AND le.entry_kind = 'POSITION' AND lt.state = 'POSTED' AND lt.effective_date <= $3::date ORDER BY lt.effective_date, lt.occurred_at, lt.id`, [portfolioId, instrumentId, asOf]);
  const transactions = (rows.rows as Array<Record<string, string>>).map((row) => ({ id: String(row.id), activityType: String(row.activity_type), effectiveDate: String(row.effective_date), occurredAt: String(row.occurred_at), quantity: Number(row.quantity || 0), amount: Number(row.amount || 0), fee: Number(row.fee_amount || 0), tax: Number(row.tax_amount || 0), currency: String(row.currency_code).trim().toUpperCase() }));
  const specificIds: Record<string, Array<{ acquisition_transaction_id: string; quantity: number }>> = {};
  const acquisitions = transactions.filter((transaction) => transaction.activityType === "BUY");
  for (const sell of transactions.filter((transaction) => transaction.activityType === "SELL")) {
    let remaining = sell.quantity;
    specificIds[sell.id] = [];
    for (const acquisition of acquisitions) {
      const quantity = Math.min(remaining, acquisition.quantity);
      if (quantity > 0) specificIds[sell.id].push({ acquisition_transaction_id: acquisition.id, quantity });
      remaining -= quantity;
      if (remaining <= 0) break;
    }
  }
  const calculation = compareTaxLotMethods({ asOf, method, transactions, specificIds });
  await auditEvent(req, res, userId, "CALCULATE", "TAX_LOT_METHODS", instrumentId, { portfolio_id: portfolioId, instrument_id: instrumentId, as_of: asOf, allocation_method: method, calculation_version: calculation.calculation_version, method_count: calculation.methods.length });
  json(res, 200, { portfolio_id: portfolioId, instrument_id: instrumentId, ...calculation });
  return true;
}

async function realizedGainsRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET" || !req.url?.startsWith("/api/v1/realized-gains")) return false;
  const url = new URL(req.url, "http://localhost");
  const portfolioId = url.searchParams.get("portfolio_id")?.trim() || "";
  const instrumentId = url.searchParams.get("instrument_id")?.trim() || "";
  const asOf = url.searchParams.get("as_of")?.trim() || new Date().toISOString().slice(0, 10);
  const baseCurrency = (url.searchParams.get("base_currency")?.trim().toUpperCase() || "EUR");
  const acquisitionFxRate = Number(url.searchParams.get("acquisition_fx_rate") || "1");
  const disposalFxRate = Number(url.searchParams.get("disposal_fx_rate") || "1");
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^[0-9a-f-]{36}$/i.test(instrumentId) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !/^[A-Z]{3}$/.test(baseCurrency) || !Number.isFinite(acquisitionFxRate) || acquisitionFxRate <= 0 || !Number.isFinite(disposalFxRate) || disposalFxRate <= 0) { json(res, 400, { error: "INVALID_REALIZED_GAIN_QUERY" }); return true; }
  const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
  if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
  const rows = await databasePool.query(`SELECT lt.id, lt.activity_type, lt.effective_date::text, lt.occurred_at, le.quantity::text, le.amount::text, le.fee_amount::text, le.tax_amount::text, le.currency_code FROM spaartrack.ledger_transaction lt JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id WHERE lt.portfolio_id = $1 AND le.instrument_id = $2 AND le.entry_kind = 'POSITION' AND lt.state = 'POSTED' AND lt.effective_date <= $3::date ORDER BY lt.effective_date, lt.occurred_at, lt.id`, [portfolioId, instrumentId, asOf]);
  const transactions = (rows.rows as Array<Record<string, string>>).map((row) => ({ id: String(row.id), activityType: String(row.activity_type), effectiveDate: String(row.effective_date), occurredAt: String(row.occurred_at), quantity: Number(row.quantity || 0), amount: Number(row.amount || 0), fee: Number(row.fee_amount || 0), tax: Number(row.tax_amount || 0), currency: String(row.currency_code).trim().toUpperCase(), fxRateToBase: String(row.activity_type) === "BUY" ? acquisitionFxRate : disposalFxRate }));
  const calculation = calculateRealizedGains({ asOf, baseCurrency, transactions });
  await auditEvent(req, res, userId, "CALCULATE", "REALIZED_GAINS", instrumentId, { portfolio_id: portfolioId, instrument_id: instrumentId, as_of: asOf, base_currency: baseCurrency, calculation_version: calculation.calculation_version, disposal_count: calculation.disposals.length });
  json(res, 200, { portfolio_id: portfolioId, instrument_id: instrumentId, ...calculation });
  return true;
}

async function fiscalYearReportRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET" || !req.url?.startsWith("/api/v1/fiscal-year-reports")) return false;
  const url = new URL(req.url, "http://localhost");
  const portfolioId = url.searchParams.get("portfolio_id")?.trim() || "";
  const fiscalYear = Number(url.searchParams.get("fiscal_year") || "");
  const jurisdiction = (url.searchParams.get("jurisdiction")?.trim().toUpperCase() || "NL");
  const baseCurrency = (url.searchParams.get("base_currency")?.trim().toUpperCase() || "EUR");
  const fiscalYearStartMonth = Number(url.searchParams.get("fiscal_year_start_month") || "1");
  const fiscalYearStartDay = Number(url.searchParams.get("fiscal_year_start_day") || "1");
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !Number.isInteger(fiscalYear) || !/^[A-Z]{2,8}$/.test(jurisdiction) || !/^[A-Z]{3}$/.test(baseCurrency)) { json(res, 400, { error: "INVALID_FISCAL_YEAR_QUERY" }); return true; }
  const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
  if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
  try {
    const periodStart = `${fiscalYear}-${String(fiscalYearStartMonth).padStart(2, "0")}-${String(fiscalYearStartDay).padStart(2, "0")}`;
    const nextYear = fiscalYearStartMonth === 1 && fiscalYearStartDay === 1 ? fiscalYear + 1 : fiscalYear + 1;
    const incomeRows = await databasePool.query(`
      SELECT id, event_type, status, payment_date::text, gross_amount::text, tax_amount::text, fee_amount::text, net_amount::text, currency_code
      FROM spaartrack.income_event
      WHERE portfolio_id = $1 AND status = 'PAID' AND payment_date >= $2::date
        AND payment_date < make_date($3, $4, $5)
      ORDER BY payment_date, id`, [portfolioId, periodStart, nextYear, fiscalYearStartMonth, fiscalYearStartDay]);
    const tradeRows = await databasePool.query(`
      SELECT lt.id, lt.activity_type, lt.effective_date::text, lt.occurred_at, le.quantity::text, le.amount::text,
             le.fee_amount::text, le.tax_amount::text, le.currency_code, le.instrument_id
      FROM spaartrack.ledger_transaction lt
      JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
      WHERE lt.portfolio_id = $1 AND le.entry_kind = 'POSITION' AND lt.state = 'POSTED'
      ORDER BY le.instrument_id, lt.effective_date, lt.occurred_at, lt.id`, [portfolioId]);
    const byInstrument = new Map<string, Array<Record<string, string>>>();
    for (const row of tradeRows.rows as Array<Record<string, string>>) {
      const key = String(row.instrument_id);
      const current = byInstrument.get(key) || [];
      current.push(row);
      byInstrument.set(key, current);
    }
    const realizedGains = [] as Array<{ id: string; disposalDate: string; taxableResult: number; currency: string; sourceActivityId: string }>;
    for (const rows of byInstrument.values()) {
      const calculation = calculateRealizedGains({
        asOf: "2999-12-31", baseCurrency,
        transactions: rows.map((row) => ({ id: String(row.id), activityType: String(row.activity_type), effectiveDate: String(row.effective_date), occurredAt: String(row.occurred_at), quantity: Number(row.quantity || 0), amount: Number(row.amount || 0), fee: Number(row.fee_amount || 0), tax: Number(row.tax_amount || 0), currency: String(row.currency_code).trim().toUpperCase(), fxRateToBase: 1 }))
      });
      for (const item of calculation.disposals) realizedGains.push({ id: `${item.acquisition_transaction_id}-${item.disposal_transaction_id}`, disposalDate: rows.find((row) => String(row.id) === item.disposal_transaction_id)?.effective_date || periodStart, taxableResult: Number(item.taxable_result), currency: String(item.currency), sourceActivityId: String(item.disposal_transaction_id) });
    }
    const report = buildFiscalYearReport({
      fiscalYear, jurisdiction, fiscalYearStartMonth, fiscalYearStartDay, baseCurrency,
      incomeEvents: (incomeRows.rows as Array<Record<string, string>>).map((row) => ({ id: String(row.id), eventType: String(row.event_type), status: String(row.status), paymentDate: String(row.payment_date), grossAmount: Number(row.gross_amount || 0), taxAmount: Number(row.tax_amount || 0), feeAmount: Number(row.fee_amount || 0), netAmount: Number(row.net_amount || 0), currency: String(row.currency_code).trim().toUpperCase() })),
      realizedGains
    });
    await auditEvent(req, res, userId, "CALCULATE", "FISCAL_YEAR_REPORT", portfolioId, { portfolio_id: portfolioId, fiscal_year: fiscalYear, jurisdiction, calculation_version: report.calculation_version, income_count: report.income.items.length, realized_gain_count: report.realized_gains.items.length });
    json(res, 200, { portfolio_id: portfolioId, ...report });
  } catch (error) {
    if ((error as Error).message === "INVALID_FISCAL_YEAR_CONFIGURATION") { json(res, 400, { error: "INVALID_FISCAL_YEAR_CONFIGURATION" }); return true; }
    throw error;
  }
  return true;
}

async function taxLossHarvestingRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET" || !req.url?.startsWith("/api/v1/tax-loss-harvesting")) return false;
  const url = new URL(req.url, "http://localhost");
  const portfolioId = url.searchParams.get("portfolio_id")?.trim() || "";
  const asOf = url.searchParams.get("as_of")?.trim() || new Date().toISOString().slice(0, 10);
  const estimatedTaxRate = Number(url.searchParams.get("estimated_tax_rate") || "0.25");
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(estimatedTaxRate) || estimatedTaxRate < 0 || estimatedTaxRate > 1) {
    json(res, 400, { error: "INVALID_TAX_LOSS_HARVESTING_QUERY" }); return true;
  }
  const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
  if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
  const rows = await databasePool.query(`
    SELECT lt.id, lt.activity_type, lt.effective_date::text, lt.occurred_at,
           le.quantity::text, le.amount::text, le.fee_amount::text, le.tax_amount::text,
           le.currency_code, le.instrument_id::text, i.name AS instrument_name,
           latest.price::text AS market_price
    FROM spaartrack.ledger_transaction lt
    JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
    JOIN spaartrack.instrument i ON i.id = le.instrument_id
    LEFT JOIN LATERAL (
      SELECT ip.price FROM spaartrack.instrument_price ip
      WHERE ip.instrument_id = le.instrument_id AND ip.price_at <= ($2::date + interval '1 day')
      ORDER BY ip.price_at DESC, ip.captured_at DESC, ip.source DESC LIMIT 1
    ) latest ON true
    WHERE lt.portfolio_id = $1 AND le.entry_kind = 'POSITION' AND lt.state = 'POSTED'
      AND lt.effective_date <= $2::date
    ORDER BY le.instrument_id, lt.effective_date, lt.occurred_at, lt.id`, [portfolioId, asOf]);
  const grouped = new Map<string, Array<Record<string, string>>>();
  const metadata = new Map<string, { name: string; currency: string; marketPrice: number }>();
  for (const row of rows.rows as Array<Record<string, string>>) {
    const instrumentId = String(row.instrument_id);
    const current = grouped.get(instrumentId) || [];
    current.push(row);
    grouped.set(instrumentId, current);
    metadata.set(instrumentId, { name: String(row.instrument_name), currency: String(row.currency_code).trim().toUpperCase(), marketPrice: Number(row.market_price || 0) });
  }
  const candidates: Array<Record<string, unknown>> = [];
  for (const [instrumentId, instrumentRows] of grouped) {
    const details = metadata.get(instrumentId)!;
    const lots = buildTaxLots({ asOf, transactions: instrumentRows.map((row) => ({
      id: String(row.id), activityType: String(row.activity_type), effectiveDate: String(row.effective_date), occurredAt: String(row.occurred_at),
      quantity: Number(row.quantity || 0), amount: Number(row.amount || 0), fee: Number(row.fee_amount || 0), tax: Number(row.tax_amount || 0), currency: details.currency
    })) }).lots;
    const calculation = buildTaxLossHarvestingCandidates({ asOf, estimatedTaxRate, lots: lots.filter((lot) => Number(lot.remaining_quantity) > 0).map((lot) => ({
      acquisitionTransactionId: lot.acquisition_transaction_id, acquisitionDate: lot.acquisition_date, remainingQuantity: Number(lot.remaining_quantity),
      costBasis: Number(lot.cost_basis), marketValue: Number(lot.remaining_quantity) * details.marketPrice, currency: details.currency
    })) });
    candidates.push(...calculation.candidates.map((candidate) => ({ ...candidate, instrument_id: instrumentId, instrument_name: details.name, market_price: fixedAmount(details.marketPrice) })));
  }
  const totalLoss = candidates.reduce((sum, candidate) => sum + Number(candidate.unrealized_loss), 0);
  const totalSaving = candidates.reduce((sum, candidate) => sum + Number(candidate.estimated_tax_saving), 0);
  const calculation = { as_of: asOf, estimated_tax_rate: estimatedTaxRate.toFixed(12), candidates, totals: { unrealized_loss: fixedAmount(totalLoss), estimated_tax_saving: fixedAmount(totalSaving) }, calculation_version: "tax-loss-harvesting-v1", source: "canonical-ledger", read_only: true };
  await auditEvent(req, res, userId, "CALCULATE", "TAX_LOSS_HARVESTING", portfolioId, { portfolio_id: portfolioId, as_of: asOf, calculation_version: calculation.calculation_version, candidate_count: candidates.length });
  json(res, 200, { portfolio_id: portfolioId, ...calculation });
  return true;
}

async function washSaleRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET" || !req.url?.startsWith("/api/v1/wash-sale-risks")) return false;
  const url = new URL(req.url, "http://localhost");
  const portfolioId = url.searchParams.get("portfolio_id")?.trim() || "";
  const asOf = url.searchParams.get("as_of")?.trim() || new Date().toISOString().slice(0, 10);
  const windowDays = Number(url.searchParams.get("window_days") || "30");
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isInteger(windowDays) || windowDays < 1 || windowDays > 365) { json(res, 400, { error: "INVALID_WASH_SALE_QUERY" }); return true; }
  const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
  if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
  const rows = await databasePool.query(`
    SELECT lt.id, lt.activity_type, lt.effective_date::text, lt.occurred_at,
           le.quantity::text, le.amount::text, le.fee_amount::text, le.tax_amount::text,
           le.currency_code, le.instrument_id::text, i.name AS instrument_name
    FROM spaartrack.ledger_transaction lt
    JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
    JOIN spaartrack.instrument i ON i.id = le.instrument_id
    WHERE lt.portfolio_id = $1 AND le.entry_kind = 'POSITION' AND lt.state = 'POSTED'
      AND lt.effective_date <= $2::date
    ORDER BY le.instrument_id, lt.effective_date, lt.occurred_at, lt.id`, [portfolioId, asOf]);
  const grouped = new Map<string, Array<Record<string, string>>>();
  for (const row of rows.rows as Array<Record<string, string>>) {
    const instrumentId = String(row.instrument_id);
    const current = grouped.get(instrumentId) || [];
    current.push(row);
    grouped.set(instrumentId, current);
  }
  const lossSales: Array<{ id: string; instrumentId: string; instrumentName: string; disposalDate: string; quantity: number; lossAmount: number; currency: string }> = [];
  const purchases: Array<{ id: string; instrumentId: string; instrumentName: string; purchaseDate: string; quantity: number; currency: string }> = [];
  for (const [instrumentId, instrumentRows] of grouped) {
    const lots: Array<{ id: string; remaining: number; unitCost: number }> = [];
    for (const row of instrumentRows) {
      const quantity = Number(row.quantity || 0);
      const amount = Number(row.amount || 0);
      const fee = Number(row.fee_amount || 0);
      const tax = Number(row.tax_amount || 0);
      const instrumentName = String(row.instrument_name);
      const currency = String(row.currency_code).trim().toUpperCase();
      if (String(row.activity_type) === "BUY") {
        lots.push({ id: String(row.id), remaining: quantity, unitCost: (amount + fee + tax) / quantity });
        purchases.push({ id: String(row.id), instrumentId, instrumentName, purchaseDate: String(row.effective_date), quantity, currency });
      } else if (String(row.activity_type) === "SELL") {
        let remaining = quantity;
        let loss = 0;
        while (remaining > 0.000000001) {
          const lot = lots.find((candidate) => candidate.remaining > 0.000000001);
          if (!lot) break;
          const take = Math.min(remaining, lot.remaining);
          loss += ((amount - fee) * take / quantity) - lot.unitCost * take;
          lot.remaining -= take;
          remaining -= take;
        }
        if (loss < -0.000000001) lossSales.push({ id: String(row.id), instrumentId, instrumentName, disposalDate: String(row.effective_date), quantity, lossAmount: Math.abs(loss), currency });
      }
    }
  }
  const calculation = detectWashSaleRisks({ windowDays, lossSales, purchases });
  await auditEvent(req, res, userId, "CALCULATE", "WASH_SALE_RISK", portfolioId, { portfolio_id: portfolioId, as_of: asOf, window_days: windowDays, calculation_version: calculation.calculation_version, risk_count: calculation.risks.length });
  json(res, 200, { portfolio_id: portfolioId, as_of: asOf, ...calculation });
  return true;
}

async function taxWorksheetRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET" || !req.url?.startsWith("/api/v1/tax-worksheets")) return false;
  const url = new URL(req.url, "http://localhost");
  const portfolioId = url.searchParams.get("portfolio_id")?.trim() || "";
  const jurisdiction = (url.searchParams.get("jurisdiction")?.trim().toUpperCase() || "NL");
  const taxYear = Number(url.searchParams.get("tax_year") || "");
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !Number.isInteger(taxYear) || !["NL", "UK"].includes(jurisdiction)) { json(res, 400, { error: "INVALID_TAX_WORKSHEET_QUERY" }); return true; }
  const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
  if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
  const periodStart = jurisdiction === "NL" ? `${taxYear}-01-01` : `${taxYear}-04-06`;
  const periodEndExclusive = jurisdiction === "NL" ? `${taxYear + 1}-01-01` : `${taxYear + 1}-04-06`;
  const periodEndInclusive = jurisdiction === "NL" ? `${taxYear}-12-31` : `${taxYear + 1}-04-05`;
  const incomeRows = await databasePool.query(`SELECT id, event_type, gross_amount::text, tax_amount::text, net_amount::text, currency_code FROM spaartrack.income_event WHERE portfolio_id = $1 AND status = 'PAID' AND payment_date >= $2::date AND payment_date < $3::date ORDER BY payment_date, id`, [portfolioId, periodStart, periodEndExclusive]);
  const tradeRows = await databasePool.query(`SELECT lt.id, lt.activity_type, lt.effective_date::text, lt.occurred_at, le.quantity::text, le.amount::text, le.fee_amount::text, le.tax_amount::text, le.currency_code, le.instrument_id::text FROM spaartrack.ledger_transaction lt JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id WHERE lt.portfolio_id = $1 AND le.entry_kind = 'POSITION' AND lt.state = 'POSTED' AND lt.effective_date <= $2::date ORDER BY le.instrument_id, lt.effective_date, lt.occurred_at, lt.id`, [portfolioId, periodEndInclusive]);
  const grouped = new Map<string, Array<Record<string, string>>>();
  for (const row of tradeRows.rows as Array<Record<string, string>>) { const key = String(row.instrument_id); const current = grouped.get(key) || []; current.push(row); grouped.set(key, current); }
  const gains: Array<{ taxableResult: number; currency: string; sourceActivityId: string }> = [];
  for (const rows of grouped.values()) {
    const calculation = calculateRealizedGains({ asOf: periodEndInclusive, baseCurrency: "EUR", transactions: rows.map((row) => ({ id: String(row.id), activityType: String(row.activity_type), effectiveDate: String(row.effective_date), occurredAt: String(row.occurred_at), quantity: Number(row.quantity || 0), amount: Number(row.amount || 0), fee: Number(row.fee_amount || 0), tax: Number(row.tax_amount || 0), currency: String(row.currency_code).trim().toUpperCase(), fxRateToBase: 1 })) });
    for (const item of calculation.disposals) { const disposalDate = rows.find((row) => String(row.id) === item.disposal_transaction_id)?.effective_date || ""; if (disposalDate >= periodStart && disposalDate < periodEndExclusive) gains.push({ taxableResult: Number(item.taxable_result), currency: String(item.currency), sourceActivityId: String(item.disposal_transaction_id) }); }
  }
  const worksheet = buildTaxWorksheet({ jurisdiction, taxYear, ownerScope: `portfolio:${portfolioId}`, income: (incomeRows.rows as Array<Record<string, string>>).map((row) => ({ kind: String(row.event_type), gross: Number(row.gross_amount || 0), tax: Number(row.tax_amount || 0), net: Number(row.net_amount || 0), currency: String(row.currency_code).trim().toUpperCase() })), gains });
  await auditEvent(req, res, userId, "CALCULATE", "TAX_WORKSHEET", portfolioId, { portfolio_id: portfolioId, jurisdiction, tax_year: taxYear, ruleset: worksheet.ruleset, calculation_version: worksheet.calculation_version });
  json(res, 200, { portfolio_id: portfolioId, ...worksheet });
  return true;
}

async function costBasisRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }
  if (req.method !== "GET" || !req.url?.startsWith("/api/v1/cost-basis")) return false;
  const url = new URL(req.url, "http://localhost");
  const portfolioId = url.searchParams.get("portfolio_id")?.trim() || "";
  const instrumentId = url.searchParams.get("instrument_id")?.trim() || "";
  const method = (url.searchParams.get("method")?.trim().toUpperCase() || "FIFO");
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^[0-9a-f-]{36}$/i.test(instrumentId)) {
    json(res, 400, { error: "INVALID_COST_BASIS_QUERY" });
    return true;
  }
  if (!["FIFO", "WAC"].includes(method)) {
    json(res, 400, { error: "INVALID_COST_BASIS_METHOD" });
    return true;
  }
  const access = await databasePool.query(
    `SELECT 1 FROM spaartrack.portfolio_member
     WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [portfolioId, userId]
  );
  if (!access.rowCount) {
    json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
    return true;
  }
  const rows = await databasePool.query(
    `SELECT lt.id, lt.activity_type, lt.effective_date::text, lt.occurred_at,
            le.quantity::text, le.amount::text, le.fee_amount::text, le.tax_amount::text,
            le.unit_price::text, le.currency_code
     FROM spaartrack.ledger_transaction lt
     JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
     WHERE lt.portfolio_id = $1 AND le.instrument_id = $2
       AND le.entry_kind = 'POSITION' AND lt.state = 'POSTED'
     ORDER BY lt.effective_date, lt.occurred_at, lt.id`,
    [portfolioId, instrumentId]
  );
  const corporateActions = await databasePool.query(
    `SELECT action_type, effective_date::text, ratio_from::text, ratio_to::text
     FROM spaartrack.corporate_action
     WHERE instrument_id = $1 AND action_type IN ('SPLIT', 'REVERSE_SPLIT')
     ORDER BY effective_date, id`,
    [instrumentId]
  );
  const lots: Array<{ acquisition_transaction_id: string; acquired_at: string; original_quantity: number; remaining_quantity: number; cost_basis: number; currency_code: string }> = [];
  let realizedGain = 0;
  let fees = 0;
  let taxes = 0;
  let wacQuantity = 0;
  let wacCost = 0;
  let actionIndex = 0;
  const applyCorporateActions = (throughDate: string): void => {
    while (actionIndex < corporateActions.rows.length && String(corporateActions.rows[actionIndex].effective_date) <= throughDate) {
      const action = corporateActions.rows[actionIndex];
      const factor = Number(action.ratio_to) / Number(action.ratio_from);
      for (const lot of lots) {
        lot.original_quantity *= factor;
        lot.remaining_quantity *= factor;
      }
      wacQuantity *= factor;
      actionIndex += 1;
    }
  };
  for (const row of rows.rows as Array<Record<string, string>>) {
    applyCorporateActions(row.effective_date);
    const quantity = Number(row.quantity || 0);
    const amount = Number(row.amount || 0);
    const fee = Number(row.fee_amount || 0);
    const tax = Number(row.tax_amount || 0);
    fees += fee;
    taxes += tax;
    if (row.activity_type === "BUY") {
      const cost = amount + fee + tax;
      lots.push({ acquisition_transaction_id: row.id, acquired_at: row.occurred_at, original_quantity: quantity, remaining_quantity: quantity, cost_basis: cost, currency_code: row.currency_code });
      wacQuantity += quantity;
      wacCost += cost;
      continue;
    }
    if (row.activity_type !== "SELL") continue;
    if (quantity > (method === "WAC" ? wacQuantity : lots.reduce((sum, lot) => sum + lot.remaining_quantity, 0)) + 0.000000001) {
      json(res, 409, { error: "INSUFFICIENT_POSITION" });
      return true;
    }
    const netProceeds = amount - fee - tax;
    if (method === "WAC") {
      const allocated = wacQuantity ? (wacCost / wacQuantity) * quantity : 0;
      wacQuantity -= quantity;
      wacCost -= allocated;
      realizedGain += netProceeds - allocated;
      continue;
    }
    let remainingToSell = quantity;
    let allocated = 0;
    for (const lot of lots) {
      if (remainingToSell <= 0) break;
      const take = Math.min(remainingToSell, lot.remaining_quantity);
      const lotCost = lot.remaining_quantity > 0 ? lot.cost_basis * (take / lot.remaining_quantity) : 0;
      allocated += lotCost;
      lot.remaining_quantity -= take;
      lot.cost_basis -= lotCost;
      remainingToSell -= take;
    }
    realizedGain += netProceeds - allocated;
  }
  applyCorporateActions("9999-12-31");
  const openLots = method === "WAC"
    ? (wacQuantity > 0.000000001 ? [{ acquisition_transaction_id: null, acquired_at: null, original_quantity: wacQuantity, remaining_quantity: wacQuantity, cost_basis: wacCost, currency_code: rows.rows[0]?.currency_code || null }] : [])
    : lots.filter((lot) => lot.remaining_quantity > 0.000000001);
  const quantity = openLots.reduce((sum, lot) => sum + Number(lot.remaining_quantity), 0);
  const costBasis = openLots.reduce((sum, lot) => sum + Number(lot.cost_basis), 0);
  json(res, 200, {
    portfolio_id: portfolioId,
    instrument_id: instrumentId,
    method,
    quantity: fixedAmount(quantity),
    cost_basis: fixedAmount(costBasis),
    realized_gain: fixedAmount(realizedGain),
    fees: fixedAmount(fees),
    taxes: fixedAmount(taxes),
    lots: openLots.map((lot) => ({
      acquisition_transaction_id: lot.acquisition_transaction_id,
      acquired_at: lot.acquired_at,
      original_quantity: fixedAmount(lot.original_quantity),
      remaining_quantity: fixedAmount(lot.remaining_quantity),
      cost_basis: fixedAmount(lot.cost_basis),
      currency_code: lot.currency_code
    })),
    calculation_version: "cost-basis-v1"
  });
  return true;
}

async function pnlRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }
  if (req.method !== "GET" || !req.url?.startsWith("/api/v1/pnl")) return false;
  const url = new URL(req.url, "http://localhost");
  const portfolioId = url.searchParams.get("portfolio_id")?.trim() || "";
  const instrumentId = url.searchParams.get("instrument_id")?.trim() || "";
  const method = (url.searchParams.get("method")?.trim().toUpperCase() || "FIFO");
  const valuationPrice = Number(url.searchParams.get("valuation_price"));
  const valuationFxRate = Number(url.searchParams.get("valuation_fx_rate") || "1");
  const costBasisFxRate = Number(url.searchParams.get("cost_basis_fx_rate") || "1");
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^[0-9a-f-]{36}$/i.test(instrumentId) ||
      !["FIFO", "WAC"].includes(method)) {
    json(res, !["FIFO", "WAC"].includes(method) ? 400 : 400, { error: !["FIFO", "WAC"].includes(method) ? "INVALID_PNL_METHOD" : "INVALID_PNL_QUERY" });
    return true;
  }
  if (!Number.isFinite(valuationPrice) || valuationPrice < 0 || !Number.isFinite(valuationFxRate) || valuationFxRate <= 0 ||
      !Number.isFinite(costBasisFxRate) || costBasisFxRate <= 0) {
    json(res, 400, { error: "INVALID_PNL_VALUATION" });
    return true;
  }
  const access = await databasePool.query(
    `SELECT 1 FROM spaartrack.portfolio_member
     WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [portfolioId, userId]
  );
  if (!access.rowCount) {
    json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
    return true;
  }
  const rows = await databasePool.query(
    `SELECT lt.id, lt.activity_type, lt.effective_date::text, lt.occurred_at, le.quantity::text,
            le.amount::text, le.fee_amount::text, le.tax_amount::text, le.currency_code
     FROM spaartrack.ledger_transaction lt
     JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
     WHERE lt.portfolio_id = $1 AND le.instrument_id = $2
       AND le.entry_kind = 'POSITION' AND lt.state = 'POSTED'
     ORDER BY lt.effective_date, lt.occurred_at, lt.id`,
    [portfolioId, instrumentId]
  );
  const corporateActions = await databasePool.query(
    `SELECT action_type, effective_date::text, ratio_from::text, ratio_to::text
     FROM spaartrack.corporate_action
     WHERE instrument_id = $1 AND action_type IN ('SPLIT', 'REVERSE_SPLIT')
     ORDER BY effective_date, id`,
    [instrumentId]
  );
  const lots: Array<{ original_quantity: number; remaining_quantity: number; cost_basis: number }> = [];
  let realizedTransactionCurrency = 0;
  let fees = 0;
  let taxes = 0;
  let wacQuantity = 0;
  let wacCost = 0;
  let actionIndex = 0;
  const applyCorporateActions = (throughDate: string): void => {
    while (actionIndex < corporateActions.rows.length && String(corporateActions.rows[actionIndex].effective_date) <= throughDate) {
      const action = corporateActions.rows[actionIndex];
      const factor = Number(action.ratio_to) / Number(action.ratio_from);
      for (const lot of lots) {
        lot.original_quantity *= factor;
        lot.remaining_quantity *= factor;
      }
      wacQuantity *= factor;
      actionIndex += 1;
    }
  };
  for (const row of rows.rows as Array<Record<string, string>>) {
    applyCorporateActions(row.effective_date);
    const quantity = Number(row.quantity || 0);
    const amount = Number(row.amount || 0);
    const fee = Number(row.fee_amount || 0);
    const tax = Number(row.tax_amount || 0);
    fees += fee;
    taxes += tax;
    if (row.activity_type === "BUY") {
      const cost = amount + fee + tax;
      lots.push({ original_quantity: quantity, remaining_quantity: quantity, cost_basis: cost });
      wacQuantity += quantity;
      wacCost += cost;
      continue;
    }
    if (row.activity_type !== "SELL") continue;
    const available = method === "WAC" ? wacQuantity : lots.reduce((sum, lot) => sum + lot.remaining_quantity, 0);
    if (quantity > available + 0.000000001) {
      json(res, 409, { error: "INSUFFICIENT_POSITION" });
      return true;
    }
    let allocated = 0;
    if (method === "WAC") {
      allocated = wacQuantity ? (wacCost / wacQuantity) * quantity : 0;
      wacQuantity -= quantity;
      wacCost -= allocated;
    } else {
      let remainingToSell = quantity;
      for (const lot of lots) {
        if (remainingToSell <= 0) break;
        const take = Math.min(remainingToSell, lot.remaining_quantity);
        const lotCost = lot.remaining_quantity > 0 ? lot.cost_basis * (take / lot.remaining_quantity) : 0;
        allocated += lotCost;
        lot.remaining_quantity -= take;
        lot.cost_basis -= lotCost;
        remainingToSell -= take;
      }
    }
    realizedTransactionCurrency += amount - fee - tax - allocated;
  }
  applyCorporateActions("9999-12-31");
  const quantity = method === "WAC" ? wacQuantity : lots.reduce((sum, lot) => sum + lot.remaining_quantity, 0);
  const costBasis = method === "WAC" ? wacCost : lots.reduce((sum, lot) => sum + lot.cost_basis, 0);
  const marketValue = valuationPrice * quantity;
  const pricePnl = (marketValue - costBasis) * costBasisFxRate;
  const fxPnl = marketValue * (valuationFxRate - costBasisFxRate);
  const unrealizedPnl = pricePnl + fxPnl;
  const realizedPnl = realizedTransactionCurrency * valuationFxRate;
  json(res, 200, {
    portfolio_id: portfolioId,
    instrument_id: instrumentId,
    method,
    quantity: fixedAmount(quantity),
    cost_basis: fixedAmount(costBasis),
    valuation_price: fixedAmount(valuationPrice),
    valuation_fx_rate: fixedAmount(valuationFxRate),
    cost_basis_fx_rate: fixedAmount(costBasisFxRate),
    market_value: fixedAmount(marketValue),
    realized_pnl_transaction_currency: fixedAmount(realizedTransactionCurrency),
    realized_pnl: fixedAmount(realizedPnl),
    price_pnl: fixedAmount(pricePnl),
    fx_pnl: fixedAmount(fxPnl),
    unrealized_pnl: fixedAmount(unrealizedPnl),
    total_pnl: fixedAmount(realizedPnl + unrealizedPnl),
    fees: fixedAmount(fees),
    taxes: fixedAmount(taxes),
    calculation_version: "pnl-v1"
  });
  return true;
}

async function corporateActionRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }
  const actionTypes = ["SPLIT", "REVERSE_SPLIT", "SPINOFF", "MERGER", "DRP", "RIGHTS_ISSUE", "TENDER", "DELISTING", "SYMBOL_CHANGE", "OTHER"];
  const actionsUrl = req.url?.startsWith("/api/v1/corporate-actions") ? new URL(req.url, "http://localhost") : null;
  if (req.method === "GET" && actionsUrl) {
    const instrumentId = actionsUrl.searchParams.get("instrument_id")?.trim() || "";
    if (instrumentId && !/^[0-9a-f-]{36}$/i.test(instrumentId)) {
      json(res, 400, { error: "INVALID_CORPORATE_ACTION_QUERY" });
      return true;
    }
    const result = await databasePool.query(
      `SELECT id, instrument_id, action_type, announced_on, ex_date, effective_date,
              ratio_from::text, ratio_to::text, successor_instrument_id, source, metadata, created_at
       FROM spaartrack.corporate_action
       WHERE ($1 = '' OR instrument_id::text = $1)
       ORDER BY effective_date, id`,
      [instrumentId]
    );
    json(res, 200, { actions: result.rows });
    return true;
  }
  if (req.method === "POST" && req.url === "/api/v1/corporate-actions") {
    try {
      const body = await readJson(req);
      const instrumentId = typeof body.instrument_id === "string" ? body.instrument_id.trim() : "";
      const actionType = typeof body.action_type === "string" ? body.action_type.trim().toUpperCase() : "";
      const effectiveDate = typeof body.effective_date === "string" ? body.effective_date : "";
      const ratioFrom = typeof body.ratio_from === "number" ? String(body.ratio_from) : typeof body.ratio_from === "string" ? body.ratio_from.trim() : null;
      const ratioTo = typeof body.ratio_to === "number" ? String(body.ratio_to) : typeof body.ratio_to === "string" ? body.ratio_to.trim() : null;
      const successorInstrumentId = typeof body.successor_instrument_id === "string" ? body.successor_instrument_id.trim() : null;
      const source = typeof body.source === "string" ? body.source.trim() : "";
      if (!/^[0-9a-f-]{36}$/i.test(instrumentId) || !actionTypes.includes(actionType) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || !source ||
          ((actionType === "SPLIT" || actionType === "REVERSE_SPLIT") &&
            (!ratioFrom || !ratioTo || !/^\d+(\.\d+)?$/.test(ratioFrom) || !/^\d+(\.\d+)?$/.test(ratioTo) || Number(ratioFrom) <= 0 || Number(ratioTo) <= 0)) ||
          (successorInstrumentId !== null && !/^[0-9a-f-]{36}$/i.test(successorInstrumentId))) {
        json(res, 400, { error: "INVALID_CORPORATE_ACTION_INPUT" });
        return true;
      }
      const references = await databasePool.query(
        `SELECT
           EXISTS (SELECT 1 FROM spaartrack.instrument WHERE id = $1) AS instrument_exists,
           ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM spaartrack.instrument WHERE id = $2)) AS successor_exists`,
        [instrumentId, successorInstrumentId]
      );
      if (!references.rows[0].instrument_exists || !references.rows[0].successor_exists) {
        json(res, 404, { error: "INSTRUMENT_NOT_FOUND" });
        return true;
      }
      const result = await databasePool.query(
        `INSERT INTO spaartrack.corporate_action
           (instrument_id, action_type, effective_date, ratio_from, ratio_to, successor_instrument_id, source, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (instrument_id, action_type, effective_date, ratio_from, ratio_to) DO NOTHING
         RETURNING id, instrument_id, action_type, announced_on, ex_date, effective_date,
                   ratio_from::text, ratio_to::text, successor_instrument_id, source, metadata, created_at`,
        [instrumentId, actionType, effectiveDate, ratioFrom, ratioTo, successorInstrumentId, source, JSON.stringify({ created_by: userId })]
      );
      if (!result.rowCount) {
        json(res, 409, { error: "CORPORATE_ACTION_ALREADY_EXISTS" });
        return true;
      }
      json(res, 201, result.rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") json(res, 409, { error: "CORPORATE_ACTION_ALREADY_EXISTS" });
      else if ((error as { code?: string }).code === "23503") json(res, 404, { error: "INSTRUMENT_NOT_FOUND" });
      else json(res, 400, { error: "INVALID_CORPORATE_ACTION_REQUEST" });
    }
    return true;
  }
  return false;
}

async function positionDetailRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }
  if (req.method !== "GET" || !req.url?.startsWith("/api/v1/position-details")) return false;
  const url = new URL(req.url, "http://localhost");
  const portfolioId = url.searchParams.get("portfolio_id")?.trim() || "";
  const instrumentId = url.searchParams.get("instrument_id")?.trim() || "";
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^[0-9a-f-]{36}$/i.test(instrumentId)) {
    json(res, 400, { error: "INVALID_POSITION_DETAIL_QUERY" });
    return true;
  }
  const access = await databasePool.query(
    `SELECT 1 FROM spaartrack.portfolio_member
     WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [portfolioId, userId]
  );
  if (!access.rowCount) {
    json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
    return true;
  }
  const instrument = await databasePool.query(
    `SELECT i.id, i.instrument_type, i.asset_class, i.name, i.short_name, i.currency_code,
            i.exchange_id, e.mic AS exchange, i.ticker, i.isin, i.cusip, i.is_listed,
            i.is_active, i.valuation_source, i.metadata, i.created_at, i.updated_at
     FROM spaartrack.instrument i
     LEFT JOIN spaartrack.exchange e ON e.id = i.exchange_id
     WHERE i.id = $1`,
    [instrumentId]
  );
  if (!instrument.rowCount) {
    json(res, 404, { error: "INSTRUMENT_NOT_FOUND" });
    return true;
  }
  const transactions = await databasePool.query(
    `SELECT lt.id, lt.activity_type, lt.effective_date::text, lt.occurred_at::text,
            lt.state, lt.description, le.financial_account_id, le.quantity::text,
            le.unit_price::text, le.amount::text, le.currency_code,
            le.fee_amount::text, le.tax_amount::text
     FROM spaartrack.ledger_transaction lt
     JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
     WHERE lt.portfolio_id = $1 AND le.instrument_id = $2
     ORDER BY lt.effective_date, lt.occurred_at, lt.id`,
    [portfolioId, instrumentId]
  );
  const events = await databasePool.query(
    `SELECT id, action_type, announced_on, ex_date, effective_date,
            ratio_from::text, ratio_to::text, successor_instrument_id, source, metadata
     FROM spaartrack.corporate_action
     WHERE instrument_id = $1 ORDER BY effective_date, id`,
    [instrumentId]
  );
  json(res, 200, {
    portfolio_id: portfolioId,
    instrument: instrumentResponse(instrument.rows[0]),
    transactions: transactions.rows,
    calendar: events.rows,
    calculation_version: "position-detail-v1"
  });
  return true;
}

async function importFileRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/import-files")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }
  if (req.method !== "POST" || req.url !== "/api/v1/import-files") {
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
    return true;
  }
  try {
    const body = await readJson(req);
    const filename = typeof body.filename === "string" ? body.filename.trim() : "";
    const contentType = typeof body.content_type === "string" ? body.content_type.trim().toLowerCase() : "";
    const encoded = typeof body.content_base64 === "string" ? body.content_base64 : "";
    const extension = filename.toLowerCase().split(".").pop() || "";
    const supported = (contentType === "text/csv" && extension === "csv")
      || (contentType === "text/tab-separated-values" && extension === "tsv")
      || (contentType === "application/json" && extension === "json");
    if (!filename || !supported) {
      json(res, 400, { error: "UNSUPPORTED_IMPORT_TYPE" });
      return true;
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
      json(res, 400, { error: "INVALID_IMPORT_CONTENT" });
      return true;
    }
    const content = Buffer.from(encoded, "base64");
    if (content.length > 5_000_000) {
      json(res, 413, { error: "IMPORT_FILE_TOO_LARGE" });
      return true;
    }
    const checksum = createHash("sha256").update(content).digest("hex");
    const safeFilename = filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(-180);
    const objectStorageKey = `imports/${userId}/${randomUUID()}-${safeFilename}`;
    const result = await databasePool.query(
      `INSERT INTO spaartrack.import_file
         (user_id, filename, content_type, object_storage_key, checksum_sha256, file_size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, checksum_sha256) DO NOTHING
       RETURNING id, user_id, portfolio_id, filename, content_type, object_storage_key,
                 checksum_sha256, file_size_bytes, parse_status, created_at`,
      [userId, filename, contentType, objectStorageKey, checksum, content.length]
    );
    if (!result.rowCount) {
      json(res, 409, { error: "IMPORT_FILE_ALREADY_EXISTS" });
      return true;
    }
    const row = result.rows[0] as Record<string, unknown>;
    await auditEvent(req, res, userId, "CREATE", "IMPORT_FILE", String(row.id), {
      filename, content_type: contentType, file_size_bytes: content.length, checksum_sha256: checksum
    });
    json(res, 201, row);
  } catch (error) {
    if ((error as Error).message === "request_too_large") json(res, 413, { error: "IMPORT_FILE_TOO_LARGE" });
    else json(res, 400, { error: "INVALID_IMPORT_REQUEST" });
  }
  return true;
}

function parseImportCsv(content: string): Array<Record<string, string>> {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const split = (line: string): string[] => {
    const values: string[] = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && line[index + 1] === '"') { value += '"'; index += 1; continue; }
      if (character === '"') { quoted = !quoted; continue; }
      if (character === "," && !quoted) { values.push(value.trim()); value = ""; continue; }
      value += character;
    }
    values.push(value.trim());
    return values;
  };
  const headers = split(lines[0]).map((header) => header.toLowerCase());
  return lines.slice(1).map((line) => Object.fromEntries(split(line).map((value, index) => [headers[index] || `column_${index + 1}`, value])));
}

function decimalText(value: unknown, fallback = "0.00"): string {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number.toFixed(2) : fallback;
}

function degiroActivityType(value: string): "BUY" | "SELL" | "DIVIDEND" | "FEE" | "TAX" | "OTHER" {
  const normalized = value.trim().toUpperCase();
  if (normalized === "BUY" || normalized === "SELL" || normalized === "DIVIDEND" || normalized === "FEE" || normalized === "TAX") return normalized;
  return "OTHER";
}

async function degiroImportRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  // DEGIRO layout_mapping yields canonical candidates in a read-only preview.
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/degiro-imports")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "POST" || req.url !== "/api/v1/degiro-imports") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const body = await readJson(req);
    const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
    const filename = typeof body.filename === "string" ? body.filename.trim() : "";
    const encoded = typeof body.content_base64 === "string" ? body.content_base64 : "";
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !filename || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) { json(res, 400, { error: "INVALID_DEGIRO_IMPORT_REQUEST" }); return true; }
    const access = await databasePool.query(`SELECT p.id FROM spaartrack.portfolio p JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = p.id WHERE p.id = $1 AND pm.user_id = $2 AND pm.revoked_at IS NULL AND p.status = 'ACTIVE' AND pm.role IN ('OWNER', 'EDITOR')`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
    const rows = parseImportCsv(Buffer.from(encoded, "base64").toString("utf8"));
    const required = ["datum", "product", "isin", "type", "stuks", "koers", "bruto bedrag", "transactiekosten", "transactiebelasting", "valuta", "mutatie", "saldo"];
    const columns = rows.length ? Object.keys(rows[0]) : [];
    if (!rows.length || !required.every((column) => columns.includes(column))) {
      json(res, 201, { provider: "DEGIRO", read_only: true, layout: { parser_version: "degiro-csv-v1", status: "REVIEW_REQUIRED", columns }, candidates: [], reconciliation: { status: "REVIEW_REQUIRED", statement_ending_balance: "0.00", calculated_balance: "0.00", difference: "0.00" } });
      return true;
    }
    const fxRates = body.fx_rates && typeof body.fx_rates === "object" && !Array.isArray(body.fx_rates) ? body.fx_rates as Record<string, unknown> : {};
    const candidates = rows.map((row, index) => ({
      row_number: index + 2, activity_type: degiroActivityType(row.type), effective_date: row.datum,
      isin: row.isin || undefined, quantity: row.stuks || undefined, price: row.koers || undefined,
      gross_amount: decimalText(row["bruto bedrag"]), fee_amount: decimalText(row.transactiekosten), tax_amount: decimalText(row.transactiebelasting),
      fx_rate: decimalText(fxRates[(row.valuta || "").toUpperCase()] || "1.00", "1.00"), cash_amount: decimalText(row.mutatie), currency_code: (row.valuta || "").toUpperCase(),
      balance_after: row.saldo || undefined, external_id: `DEGIRO:${row.datum}:${row.type}:${row.isin || "CASH"}:${index + 2}`
    }));
    const calculatedBalance = decimalText(body.calculated_balance ?? rows.at(-1)?.saldo);
    const statementEndingBalance = decimalText(body.statement_ending_balance ?? rows.at(-1)?.saldo);
    const difference = (Number(statementEndingBalance) - Number(calculatedBalance)).toFixed(2);
    const reconciliationStatus = difference === "0.00" ? "MATCHED" : "BALANCE_MISMATCH";
    const client = await databasePool.connect();
    try {
      await client.query("BEGIN");
      const session = await client.query(`INSERT INTO spaartrack.import_session (user_id, portfolio_id, status, parser_version, rows_seen, rows_valid, rows_warning, rows_error) VALUES ($1, $2, $3, 'degiro-csv-v1', $4, $5, $6, 0) RETURNING id`, [userId, portfolioId, reconciliationStatus === "MATCHED" ? "PREVIEWED" : "REVIEW_REQUIRED", candidates.length, candidates.length, reconciliationStatus === "MATCHED" ? 0 : candidates.length]);
      const sessionId = String(session.rows[0].id);
      for (const candidate of candidates) await client.query(`INSERT INTO spaartrack.import_row_review (import_session_id, row_number, raw_row, normalized_row, status, error_codes) VALUES ($1, $2, $3, $4, 'VALID', '[]')`, [sessionId, candidate.row_number, JSON.stringify(rows[candidate.row_number - 2]), JSON.stringify(candidate)]);
      if (reconciliationStatus !== "MATCHED") await client.query(`INSERT INTO spaartrack.reconciliation_issue (portfolio_id, import_session_id, issue_type, severity, status, message, evidence) VALUES ($1, $2, 'BALANCE_MISMATCH', 'WARNING', 'OPEN', $3, $4)`, [portfolioId, sessionId, "DEGIRO statement ending balance does not match calculated balance", JSON.stringify({ statement_ending_balance: statementEndingBalance, calculated_balance: calculatedBalance, difference })]);
      await client.query("COMMIT");
      await auditEvent(req, res, userId, "CREATE", "DEGIRO_IMPORT_PREVIEW", sessionId, { portfolio_id: portfolioId, parser_version: "degiro-csv-v1", rows_seen: candidates.length, reconciliation_status: reconciliationStatus });
      json(res, 201, { import_session_id: sessionId, provider: "DEGIRO", read_only: true, layout: { parser_version: "degiro-csv-v1", status: "MATCHED", columns }, counts: { rows_seen: candidates.length, candidates: candidates.length }, candidates, reconciliation: { status: reconciliationStatus, statement_ending_balance: statementEndingBalance, calculated_balance: calculatedBalance, difference } });
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  } catch (error) { console.error(redactedLog({ level: "error", operation: "degiro_import_failed", error: (error as Error).message })); if (!res.writableEnded) json(res, 400, { error: "DEGIRO_IMPORT_FAILED" }); }
  return true;
}

function validateImportRow(row: Record<string, string>, currencies: Set<string>): { status: string; errorCodes: string[]; normalized: Record<string, unknown> } {
  const normalized = {
    date: row.date || null,
    activity_type: (row.action || "").toUpperCase(),
    amount: row.amount || null,
    currency_code: (row.currency || "").toUpperCase(),
    provider_id: row.provider_id || row.external_id || null,
    provider_hash: row.provider_hash || row.external_hash || null
  };
  const activity = String(normalized.activity_type);
  if (!currencies.has(String(normalized.currency_code)) || !activityTypes.includes(activity as typeof activityTypes[number])) return { status: "UNSUPPORTED", errorCodes: ["VALIDATION_ROW_UNSUPPORTED"], normalized };
  if (!normalized.date || Number.isNaN(Date.parse(String(normalized.date))) || !/^\d{4}-\d{2}-\d{2}$/.test(String(normalized.date)) || !normalized.amount || !/^\d+(\.\d+)?$/.test(String(normalized.amount)) || Number(normalized.amount) < 0) return { status: "ERROR", errorCodes: ["VALIDATION_ERROR"], normalized };
  if (new Date(`${String(normalized.date)}T00:00:00Z`).getTime() > Date.now()) return { status: "WARNING", errorCodes: ["VALIDATION_WARNING"], normalized };
  return { status: "VALID", errorCodes: [], normalized };
}

async function importValidationRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  // canonical import boundary: validation is read-only with respect to the ledger.
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/import-validations")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "POST" || req.url !== "/api/v1/import-validations") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const body = await readJson(req);
    const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
    const filename = typeof body.filename === "string" ? body.filename.trim() : "";
    const encoded = typeof body.content_base64 === "string" ? body.content_base64 : "";
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !filename || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) { json(res, 400, { error: "INVALID_IMPORT_VALIDATION_REQUEST" }); return true; }
    const access = await databasePool.query(`SELECT p.id FROM spaartrack.portfolio p JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = p.id WHERE p.id = $1 AND pm.user_id = $2 AND pm.revoked_at IS NULL AND p.status = 'ACTIVE' AND pm.role IN ('OWNER', 'EDITOR')`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
    const rows = parseImportCsv(Buffer.from(encoded, "base64").toString("utf8"));
    if (!rows.length) { json(res, 400, { error: "IMPORT_VALIDATION_NO_ROWS" }); return true; }
    const knownCurrencies = await databasePool.query("SELECT code FROM spaartrack.currency");
    const currencies = new Set(knownCurrencies.rows.map((row) => String(row.code).trim().toUpperCase()));
    const providerIds = rows.map((row) => row.provider_id || row.external_id).filter(Boolean);
    const providerHashes = rows.map((row) => row.provider_hash || row.external_hash).filter(Boolean);
    const duplicateRows = await databasePool.query(
      `SELECT external_id, external_hash FROM spaartrack.ledger_transaction
       WHERE portfolio_id = $1 AND ((external_id IS NOT NULL AND external_id = ANY($2::text[]))
          OR (external_hash IS NOT NULL AND external_hash = ANY($3::text[])))`,
      [portfolioId, providerIds, providerHashes]
    );
    const duplicateById = new Set(duplicateRows.rows.map((row) => String(row.external_id || "")).filter(Boolean));
    const duplicateByHash = new Set(duplicateRows.rows.map((row) => String(row.external_hash || "")).filter(Boolean));
    const seenIds = new Set<string>();
    const seenHashes = new Set<string>();
    const reviewed = rows.map((row, index) => {
      const validation = validateImportRow(row, currencies);
      const providerId = row.provider_id || row.external_id || "";
      const providerHash = row.provider_hash || row.external_hash || "";
      const duplicateReason = providerId && (duplicateById.has(providerId) || seenIds.has(providerId))
        ? "provider_id"
        : providerHash && (duplicateByHash.has(providerHash) || seenHashes.has(providerHash))
          ? "provider_hash"
          : null;
      if (providerId) seenIds.add(providerId);
      if (providerHash) seenHashes.add(providerHash);
      return {
        row,
        rowNumber: index + 2,
        reviewId: "",
        ...validation,
        status: duplicateReason ? "DUPLICATE" : validation.status,
        duplicate_reason: duplicateReason,
        errorCodes: duplicateReason ? [duplicateReason === "provider_id" ? importDuplicateReasonCodes[0] : importDuplicateReasonCodes[1]] : validation.errorCodes
      };
    });
    const counts = { rows_seen: reviewed.length, rows_valid: reviewed.filter((item) => item.status === "VALID").length, rows_warning: reviewed.filter((item) => item.status === "WARNING").length, rows_error: reviewed.filter((item) => item.status === "ERROR").length, rows_unsupported: reviewed.filter((item) => item.status === "UNSUPPORTED").length, rows_duplicate: reviewed.filter((item) => item.status === "DUPLICATE").length };
    const client = await databasePool.connect();
    try {
      await client.query("BEGIN");
      const session = await client.query(`INSERT INTO spaartrack.import_session (user_id, portfolio_id, status, parser_version, rows_seen, rows_valid, rows_warning, rows_error) VALUES ($1, $2, $3, 'csv-validation-v1', $4, $5, $6, $7) RETURNING id`, [userId, portfolioId, counts.rows_error || counts.rows_unsupported || counts.rows_duplicate ? "REVIEW_REQUIRED" : "PREVIEWED", counts.rows_seen, counts.rows_valid, counts.rows_warning, counts.rows_error + counts.rows_unsupported + counts.rows_duplicate]);
      const sessionId = String(session.rows[0].id);
      for (const item of reviewed) {
        const review = await client.query(`INSERT INTO spaartrack.import_row_review (import_session_id, row_number, raw_row, normalized_row, status, error_codes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [sessionId, item.rowNumber, JSON.stringify(item.row), JSON.stringify(item.normalized), item.status, JSON.stringify(item.errorCodes)]);
        item.reviewId = String(review.rows[0].id);
      }
      await client.query("COMMIT");
      await auditEvent(req, res, userId, "CREATE", "IMPORT_VALIDATION", sessionId, { portfolio_id: portfolioId, filename, ...counts });
      json(res, 201, { import_session_id: sessionId, filename, status: counts.rows_error || counts.rows_unsupported || counts.rows_duplicate ? "REVIEW_REQUIRED" : "PREVIEWED", counts, rows: reviewed.map((item) => ({ id: item.reviewId, row_number: item.rowNumber, raw_row: item.row, normalized_row: item.normalized, status: item.status, error_codes: item.errorCodes, duplicate_reason: item.duplicate_reason })) });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "import_validation_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "IMPORT_VALIDATION_FAILED" });
  }
  return true;
}

async function importRowReviewRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/import-row-reviews/")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const match = req.url.match(/^\/api\/v1\/import-row-reviews\/([0-9a-f-]{36})$/i);
  if (!match || req.method !== "PATCH") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const body = await readJson(req);
    const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
    const correction = body.correction && typeof body.correction === "object" && !Array.isArray(body.correction) ? body.correction as Record<string, unknown> : {};
    const normalized = body.normalized_row && typeof body.normalized_row === "object" && !Array.isArray(body.normalized_row) ? body.normalized_row as Record<string, unknown> : null;
    if (!["ACCEPTED", "REJECTED"].includes(status) || !Object.keys(correction).length || !normalized) { json(res, 400, { error: "INVALID_IMPORT_ROW_REVIEW" }); return true; }
    const result = await databasePool.query(
      `UPDATE spaartrack.import_row_review r SET status = $1, normalized_row = $2, resolved_values = $3, resolved_by = $4, resolved_at = now()
       FROM spaartrack.import_session s JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = s.portfolio_id
       WHERE r.id = $5 AND r.import_session_id = s.id AND pm.user_id = $4 AND pm.revoked_at IS NULL AND pm.role IN ('OWNER', 'EDITOR')
       RETURNING r.id, r.row_number, r.raw_row, r.normalized_row, r.status, r.error_codes, r.resolved_values, r.resolved_by, r.resolved_at`,
      [status, JSON.stringify(normalized), JSON.stringify(correction), userId, match[1]]
    );
    if (!result.rowCount) { json(res, 404, { error: "IMPORT_ROW_REVIEW_NOT_FOUND" }); return true; }
    const row = result.rows[0] as Record<string, unknown>;
    await auditEvent(req, res, userId, "CORRECTION", "IMPORT_ROW_REVIEW", String(row.id), { status, correction });
    json(res, 200, { ...row, actor_id: userId, correction_reason: "CORRECTION" });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "import_row_review_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "IMPORT_ROW_REVIEW_FAILED" });
  }
  return true;
}

async function reconciliationIssueRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/reconciliation-issues")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const issueId = parsed.pathname.match(/^\/api\/v1\/reconciliation-issues\/([0-9a-f-]{36})$/i)?.[1];
    if (req.method === "GET" && parsed.pathname === "/api/v1/reconciliation-issues") {
      const portfolioId = parsed.searchParams.get("portfolio_id") || "";
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) { json(res, 400, { error: "INVALID_RECONCILIATION_QUERY" }); return true; }
      const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
      const status = parsed.searchParams.get("status");
      const values: unknown[] = [portfolioId];
      const statusClause = status && reconciliationStatuses.includes(status as typeof reconciliationStatuses[number]) ? ` AND ri.status = $2` : "";
      if (statusClause) values.push(status);
      const result = await databasePool.query(`SELECT ri.id, ri.portfolio_id, ri.issue_type, ri.severity, ri.status, ri.message, ri.evidence, ri.resolution, ri.created_at, ri.resolved_at, ri.resolved_by FROM spaartrack.reconciliation_issue ri WHERE ri.portfolio_id = $1${statusClause} ORDER BY ri.created_at ASC`, values);
      json(res, 200, { portfolio_id: portfolioId, issues: result.rows });
      return true;
    }
    if (req.method === "POST" && parsed.pathname === "/api/v1/reconciliation-issues") {
      const body = await readJson(req);
      const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
      const issueType = typeof body.issue_type === "string" ? body.issue_type.trim().toUpperCase() : "";
      const severity = typeof body.severity === "string" ? body.severity.trim().toUpperCase() : "WARNING";
      const message = typeof body.message === "string" ? body.message.trim() : "";
      const evidence = body.evidence && typeof body.evidence === "object" && !Array.isArray(body.evidence) ? body.evidence as Record<string, unknown> : {};
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !reconciliationIssueTypes.includes(issueType as typeof reconciliationIssueTypes[number]) || !reconciliationSeverities.includes(severity as typeof reconciliationSeverities[number]) || !message || message.length > 500) { json(res, 400, { error: "INVALID_RECONCILIATION_ISSUE" }); return true; }
      const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL AND role IN ('OWNER', 'EDITOR')`, [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
      const result = await databasePool.query(`INSERT INTO spaartrack.reconciliation_issue (portfolio_id, import_session_id, issue_type, severity, message, evidence) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, portfolio_id, issue_type, severity, status, message, evidence, resolution, created_at, resolved_at, resolved_by`, [portfolioId, typeof body.import_session_id === "string" ? body.import_session_id : null, issueType, severity, message, JSON.stringify(evidence)]);
      const issue = result.rows[0];
      await auditEvent(req, res, userId, "CREATE", "RECONCILIATION_ISSUE", String(issue.id), { portfolio_id: portfolioId, issue_type: issueType, severity });
      json(res, 201, issue);
      return true;
    }
    if (req.method === "PATCH" && issueId && parsed.pathname.startsWith("/api/v1/reconciliation-issues/")) {
      const body = await readJson(req);
      const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
      const resolution = body.resolution && typeof body.resolution === "object" && !Array.isArray(body.resolution) ? body.resolution as Record<string, unknown> : {};
      if (!reconciliationStatuses.includes(status as typeof reconciliationStatuses[number]) || (status === "RESOLVED" && !Object.keys(resolution).length)) { json(res, 400, { error: "INVALID_RECONCILIATION_RESOLUTION" }); return true; }
      const result = await databasePool.query(`UPDATE spaartrack.reconciliation_issue ri SET status = $1, resolution = $2, resolved_at = CASE WHEN $1 IN ('RESOLVED', 'IGNORED') THEN now() ELSE NULL END, resolved_by = CASE WHEN $1 IN ('RESOLVED', 'IGNORED') THEN $3 ELSE NULL END WHERE ri.id = $4 AND EXISTS (SELECT 1 FROM spaartrack.portfolio_member pm WHERE pm.portfolio_id = ri.portfolio_id AND pm.user_id = $3 AND pm.revoked_at IS NULL AND pm.role IN ('OWNER', 'EDITOR')) RETURNING ri.id, ri.portfolio_id, ri.issue_type, ri.severity, ri.status, ri.message, ri.evidence, ri.resolution, ri.created_at, ri.resolved_at, ri.resolved_by`, [status, JSON.stringify(resolution), userId, issueId]);
      if (!result.rowCount) { json(res, 404, { error: "RECONCILIATION_ISSUE_NOT_FOUND" }); return true; }
      const issue = result.rows[0];
      await auditEvent(req, res, userId, status === "RESOLVED" ? "RECONCILIATION_ISSUE_RESOLVED" : "RECONCILIATION_ISSUE_UPDATED", "RECONCILIATION_ISSUE", String(issue.id), { status, resolution });
      json(res, 200, issue);
      return true;
    }
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "reconciliation_issue_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "RECONCILIATION_ISSUE_FAILED" });
  }
  return true;
}

const incomeEventColumns = `id, portfolio_id, instrument_id, event_type, status, announced_on::text, ex_date::text, record_date::text, payment_date::text, amount_per_unit::text, gross_amount::text, tax_amount::text, fee_amount::text, net_amount::text, currency_code, created_at`;

function incomeEventResponse(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    portfolio_id: row.portfolio_id,
    instrument_id: row.instrument_id,
    event_type: row.event_type,
    status: row.status,
    announced_on: row.announced_on,
    ex_date: row.ex_date,
    record_date: row.record_date,
    payment_date: row.payment_date,
    amount_per_unit: row.amount_per_unit,
    gross_amount: row.gross_amount,
    tax_amount: row.tax_amount,
    fee_amount: row.fee_amount,
    net_amount: row.net_amount,
    currency_code: row.currency_code,
    created_at: row.created_at
  };
}

async function incomeEventRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/income-events")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const eventId = parsed.pathname.match(/^\/api\/v1\/income-events\/([0-9a-f-]{36})$/i)?.[1];
    if (req.method === "GET" && parsed.pathname === "/api/v1/income-events") {
      const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) { json(res, 400, { error: "INVALID_INCOME_EVENT_QUERY" }); return true; }
      const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
      const status = parsed.searchParams.get("status")?.trim().toUpperCase() || "";
      const instrumentId = parsed.searchParams.get("instrument_id")?.trim() || "";
      if (status && !incomeEventStatuses.includes(status as typeof incomeEventStatuses[number])) { json(res, 400, { error: "INVALID_INCOME_EVENT_QUERY" }); return true; }
      if (instrumentId && !/^[0-9a-f-]{36}$/i.test(instrumentId)) { json(res, 400, { error: "INVALID_INCOME_EVENT_QUERY" }); return true; }
      const values: unknown[] = [portfolioId];
      let clause = "";
      if (status) { values.push(status); clause += ` AND status = $${values.length}`; }
      if (instrumentId) { values.push(instrumentId); clause += ` AND instrument_id::text = $${values.length}`; }
      const result = await databasePool.query(
        `SELECT ${incomeEventColumns} FROM spaartrack.income_event
         WHERE portfolio_id = $1${clause}
         ORDER BY COALESCE(payment_date, ex_date, announced_on) ASC NULLS LAST, created_at ASC, id`,
        values
      );
      const events = result.rows.map(incomeEventResponse);
      const received = events.filter((event) => event.status === "PAID");
      const expected = events.filter((event) => incomeExpectedStatuses.includes(event.status as typeof incomeExpectedStatuses[number]));
      const counts = {
        total: events.length,
        received: received.length,
        expected: expected.length,
        announced: events.filter((event) => event.status === "ANNOUNCED").length,
        projected: events.filter((event) => event.status === "PROJECTED").length,
        ex_date: events.filter((event) => event.status === "EX_DATE").length,
        paid: events.filter((event) => event.status === "PAID").length
      };
      json(res, 200, { portfolio_id: portfolioId, events, received, expected, counts });
      return true;
    }
    if (req.method === "POST" && parsed.pathname === "/api/v1/income-events") {
      const body = await readJson(req);
      const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
      const instrumentId = typeof body.instrument_id === "string" && body.instrument_id.trim() ? body.instrument_id.trim() : null;
      const eventType = typeof body.event_type === "string" ? body.event_type.trim().toUpperCase() : "DIVIDEND";
      const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "ANNOUNCED";
      const currencyCode = typeof body.currency_code === "string" ? body.currency_code.trim().toUpperCase() : "";
      const dateOrNull = (value: unknown): string | null => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null);
      const amountOrNull = (value: unknown): string | null => (value === undefined || value === null || value === "" ? null : String(value).trim());
      const announcedOn = dateOrNull(body.announced_on);
      const exDate = dateOrNull(body.ex_date);
      const recordDate = dateOrNull(body.record_date);
      const paymentDate = dateOrNull(body.payment_date);
      const amountPerUnit = amountOrNull(body.amount_per_unit);
      const grossAmount = amountOrNull(body.gross_amount);
      const netAmount = amountOrNull(body.net_amount);
      const taxAmount = amountOrNull(body.tax_amount) ?? "0";
      const feeAmount = amountOrNull(body.fee_amount) ?? "0";
      const isNumeric = (value: string | null): boolean => value === null || /^-?\d+(\.\d+)?$/.test(value);
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !incomeEventTypes.includes(eventType as typeof incomeEventTypes[number]) ||
          !incomeEventStatuses.includes(status as typeof incomeEventStatuses[number]) || !/^[A-Z]{3}$/.test(currencyCode) ||
          (instrumentId !== null && !/^[0-9a-f-]{36}$/i.test(instrumentId)) ||
          !isNumeric(amountPerUnit) || !isNumeric(grossAmount) || !isNumeric(netAmount) || !isNumeric(taxAmount) || !isNumeric(feeAmount)) {
        json(res, 400, { error: "INVALID_INCOME_EVENT_INPUT" });
        return true;
      }
      const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL AND role IN ('OWNER', 'EDITOR')`, [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
      const references = await databasePool.query(
        `SELECT ($1::uuid IS NULL OR EXISTS (SELECT 1 FROM spaartrack.instrument WHERE id = $1)) AS instrument_ok,
                EXISTS (SELECT 1 FROM spaartrack.currency WHERE code = $2) AS currency_ok`,
        [instrumentId, currencyCode]
      );
      if (!references.rows[0].currency_ok) { json(res, 404, { error: "CURRENCY_NOT_FOUND" }); return true; }
      if (!references.rows[0].instrument_ok) { json(res, 404, { error: "INSTRUMENT_NOT_FOUND" }); return true; }
      const result = await databasePool.query(
        `INSERT INTO spaartrack.income_event
           (instrument_id, portfolio_id, event_type, status, announced_on, ex_date, record_date, payment_date, amount_per_unit, gross_amount, tax_amount, fee_amount, net_amount, currency_code, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING ${incomeEventColumns}`,
        [instrumentId, portfolioId, eventType, status, announcedOn, exDate, recordDate, paymentDate, amountPerUnit, grossAmount, taxAmount, feeAmount, netAmount, currencyCode, JSON.stringify({ created_by: userId })]
      );
      const event = incomeEventResponse(result.rows[0]);
      await auditEvent(req, res, userId, "CREATE", "INCOME_EVENT", String(event.id), { portfolio_id: portfolioId, status, event_type: eventType });
      json(res, 201, event);
      return true;
    }
    if (req.method === "PATCH" && eventId) {
      const body = await readJson(req);
      const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
      const paymentDate = typeof body.payment_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.payment_date.trim()) ? body.payment_date.trim() : null;
      if (!incomeEventStatuses.includes(status as typeof incomeEventStatuses[number])) { json(res, 400, { error: "INVALID_INCOME_EVENT_STATUS" }); return true; }
      const result = await databasePool.query(
        `UPDATE spaartrack.income_event ie
            SET status = $1,
                payment_date = COALESCE($2::date, ie.payment_date)
          WHERE ie.id = $3
            AND EXISTS (SELECT 1 FROM spaartrack.portfolio_member pm WHERE pm.portfolio_id = ie.portfolio_id AND pm.user_id = $4 AND pm.revoked_at IS NULL AND pm.role IN ('OWNER', 'EDITOR'))
          RETURNING ${incomeEventColumns}`,
        [status, paymentDate, eventId, userId]
      );
      if (!result.rowCount) { json(res, 404, { error: "INCOME_EVENT_NOT_FOUND" }); return true; }
      const event = incomeEventResponse(result.rows[0]);
      await auditEvent(req, res, userId, "INCOME_EVENT_STATUS_UPDATED", "INCOME_EVENT", String(event.id), { status });
      json(res, 200, event);
      return true;
    }
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "income_event_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "INCOME_EVENT_FAILED" });
  }
  return true;
}

async function incomeMetricsRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/income-metrics")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
    const instrumentId = parsed.searchParams.get("instrument_id")?.trim() || "";
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || (instrumentId && !/^[0-9a-f-]{36}$/i.test(instrumentId))) { json(res, 400, { error: "INVALID_INCOME_METRICS_QUERY" }); return true; }
    const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
    const values: unknown[] = [portfolioId];
    const instrumentClause = instrumentId ? " AND ie.instrument_id = $2" : "";
    if (instrumentId) values.push(instrumentId);
    const result = await databasePool.query(
      `WITH income AS (
         SELECT ie.instrument_id, ie.currency_code,
                SUM(COALESCE(ie.gross_amount, 0)) AS gross_amount,
                SUM(COALESCE(ie.tax_amount, 0)) AS tax_amount,
                SUM(COALESCE(ie.fee_amount, 0)) AS fee_amount,
                SUM(COALESCE(ie.net_amount, COALESCE(ie.gross_amount, 0) - COALESCE(ie.tax_amount, 0) - COALESCE(ie.fee_amount, 0))) AS net_amount,
                COUNT(*)::integer AS event_count
           FROM spaartrack.income_event ie
          WHERE ie.portfolio_id = $1${instrumentClause}
          GROUP BY ie.instrument_id, ie.currency_code
       ), holdings AS (
         SELECT le.instrument_id,
                SUM(CASE WHEN lt.activity_type IN ('BUY', 'TRANSFER_IN', 'DIVIDEND_IN_KIND') THEN COALESCE(le.quantity, 0)
                         WHEN lt.activity_type IN ('SELL', 'TRANSFER_OUT') THEN -COALESCE(le.quantity, 0) ELSE 0 END) AS quantity,
                SUM(CASE WHEN lt.activity_type IN ('BUY', 'TRANSFER_IN', 'DIVIDEND_IN_KIND') THEN le.amount + le.fee_amount + le.tax_amount
                         WHEN lt.activity_type IN ('SELL', 'TRANSFER_OUT') THEN -(le.amount - le.fee_amount - le.tax_amount) ELSE 0 END) AS cost_basis
           FROM spaartrack.ledger_transaction lt
           JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
          WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED' AND le.entry_kind = 'POSITION'${instrumentId ? " AND le.instrument_id = $2" : ""}
          GROUP BY le.instrument_id
       )
       SELECT i.instrument_id, ins.name AS instrument_name, i.currency_code,
              i.gross_amount::text, i.tax_amount::text, i.fee_amount::text, i.net_amount::text, i.event_count,
              h.quantity::text, h.cost_basis::text, lp.price::text AS valuation_price,
              (h.quantity * lp.price)::text AS market_value
         FROM income i
         LEFT JOIN holdings h ON h.instrument_id = i.instrument_id
         LEFT JOIN spaartrack.instrument ins ON ins.id = i.instrument_id
         LEFT JOIN LATERAL (
           SELECT ip.price FROM spaartrack.instrument_price ip
            WHERE ip.instrument_id = i.instrument_id
            ORDER BY ip.price_at DESC, ip.captured_at DESC LIMIT 1
         ) lp ON true
        ORDER BY ins.name NULLS LAST, i.instrument_id`, values
    );
    const metrics = result.rows.map((row) => {
      const gross = Number(row.gross_amount || 0);
      const tax = Number(row.tax_amount || 0);
      const fee = Number(row.fee_amount || 0);
      const net = Number(row.net_amount || 0);
      const costBasis = row.cost_basis === null ? null : Number(row.cost_basis);
      const marketValue = row.market_value === null ? null : Number(row.market_value);
      return {
        instrument_id: row.instrument_id,
        instrument_name: row.instrument_name || "Portfolio",
        currency_code: row.currency_code,
        event_count: row.event_count,
        gross_amount: fixedAmount(gross),
        tax_amount: fixedAmount(tax),
        fee_amount: fixedAmount(fee),
        net_amount: fixedAmount(net),
        quantity: row.quantity === null ? null : fixedAmount(Number(row.quantity)),
        valuation_price: row.valuation_price === null ? null : fixedAmount(Number(row.valuation_price)),
        market_value: marketValue === null ? null : fixedAmount(marketValue),
        cost_basis: costBasis === null ? null : fixedAmount(costBasis),
        yield: marketValue && marketValue > 0 ? fixedAmount(net / marketValue * 100) : null,
        yield_on_cost: costBasis && costBasis > 0 ? fixedAmount(net / costBasis * 100) : null,
        formula_version: "income-metrics-v1"
      };
    });
    json(res, 200, { portfolio_id: portfolioId, calculation_version: "income-metrics-v1", formula_version: "income-metrics-v1", metrics });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "income_metrics_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "INCOME_METRICS_FAILED" });
  }
  return true;
}

function dividendForecastResponse(row: Record<string, unknown>): Record<string, unknown> {
  const gross = Number(row.forecast_amount_gross || 0);
  const tax = Number(row.forecast_tax || 0);
  const net = row.forecast_amount_net === null || row.forecast_amount_net === undefined
    ? gross - tax
    : Number(row.forecast_amount_net);
  return {
    id: row.id,
    portfolio_id: row.portfolio_id,
    instrument_id: row.instrument_id,
    forecast_period_start: row.forecast_period_start,
    forecast_period_end: row.forecast_period_end,
    forecast_amount_gross: fixedAmount(gross),
    forecast_tax: fixedAmount(tax),
    forecast_amount_net: fixedAmount(net),
    currency_code: row.currency_code,
    model: row.model,
    confidence: row.confidence === null || row.confidence === undefined ? null : fixedAmount(Number(row.confidence)),
    created_at: row.created_at
  };
}

// TTM (trailing twelve months) is realized PAID income; PADI is explicit forecast income.
const dividendForecastColumns = `id, portfolio_id, instrument_id, forecast_period_start, forecast_period_end,
  forecast_amount_gross, forecast_tax, forecast_amount_net, currency_code, model, confidence, created_at`;

async function dividendForecastRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/dividend-forecasts")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    if (req.method === "GET" && parsed.pathname === "/api/v1/dividend-forecasts") {
      const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) { json(res, 400, { error: "INVALID_DIVIDEND_FORECAST_QUERY" }); return true; }
      const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
      const result = await databasePool.query(`SELECT ${dividendForecastColumns} FROM spaartrack.dividend_forecast WHERE portfolio_id = $1 ORDER BY forecast_period_start, created_at, id`, [portfolioId]);
      json(res, 200, { portfolio_id: portfolioId, forecasts: result.rows.map(dividendForecastResponse), calculation_version: "dividend-income-v1" });
      return true;
    }
    if (req.method !== "POST" || parsed.pathname !== "/api/v1/dividend-forecasts") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
    const body = await readJson(req);
    const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
    const instrumentId = typeof body.instrument_id === "string" ? body.instrument_id.trim() : "";
    const start = typeof body.forecast_period_start === "string" ? body.forecast_period_start.trim() : "";
    const end = typeof body.forecast_period_end === "string" ? body.forecast_period_end.trim() : "";
    const currencyCode = typeof body.currency_code === "string" ? body.currency_code.trim().toUpperCase() : "";
    const model = typeof body.model === "string" ? body.model.trim() : "";
    const gross = body.forecast_amount_gross === undefined ? "" : String(body.forecast_amount_gross).trim();
    const tax = body.forecast_tax === undefined ? "0" : String(body.forecast_tax).trim();
    const net = body.forecast_amount_net === undefined || body.forecast_amount_net === null || body.forecast_amount_net === "" ? null : String(body.forecast_amount_net).trim();
    const confidence = body.confidence === undefined || body.confidence === null || body.confidence === "" ? null : String(body.confidence).trim();
    const numeric = (value: string | null): boolean => value === null || /^\d+(\.\d+)?$/.test(value);
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^[0-9a-f-]{36}$/i.test(instrumentId) || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end || !/^[A-Z]{3}$/.test(currencyCode) || !model || !numeric(gross) || !numeric(tax) || !numeric(net) || !numeric(confidence)) {
      json(res, 400, { error: "INVALID_DIVIDEND_FORECAST_INPUT" }); return true;
    }
    const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL AND role IN ('OWNER', 'EDITOR')`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
    const references = await databasePool.query(`SELECT EXISTS (SELECT 1 FROM spaartrack.instrument WHERE id = $1) AS instrument_ok, EXISTS (SELECT 1 FROM spaartrack.currency WHERE code = $2) AS currency_ok`, [instrumentId, currencyCode]);
    if (!references.rows[0].instrument_ok) { json(res, 404, { error: "INSTRUMENT_NOT_FOUND" }); return true; }
    if (!references.rows[0].currency_ok) { json(res, 404, { error: "CURRENCY_NOT_FOUND" }); return true; }
    const result = await databasePool.query(
      `INSERT INTO spaartrack.dividend_forecast
        (portfolio_id, instrument_id, forecast_period_start, forecast_period_end, forecast_amount_gross, forecast_tax, forecast_amount_net, currency_code, model, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${dividendForecastColumns}`,
      [portfolioId, instrumentId, start, end, gross, tax, net, currencyCode, model, confidence]
    );
    const forecast = dividendForecastResponse(result.rows[0]);
    await auditEvent(req, res, userId, "CREATE", "DIVIDEND_FORECAST", String(forecast.id), { portfolio_id: portfolioId, model });
    json(res, 201, forecast);
    return true;
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "dividend_forecast_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "DIVIDEND_FORECAST_FAILED" });
  }
  return true;
}

async function dividendSummaryRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/dividend-summary")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
    const asOf = parsed.searchParams.get("as_of")?.trim() || new Date().toISOString().slice(0, 10);
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) { json(res, 400, { error: "INVALID_DIVIDEND_SUMMARY_QUERY" }); return true; }
    const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
    const ttm = await databasePool.query(
      `SELECT COALESCE(SUM(COALESCE(gross_amount, 0)), 0)::text AS gross_amount,
              COALESCE(SUM(COALESCE(tax_amount, 0)), 0)::text AS tax_amount,
              COALESCE(SUM(COALESCE(fee_amount, 0)), 0)::text AS fee_amount,
              COALESCE(SUM(COALESCE(net_amount, COALESCE(gross_amount, 0) - COALESCE(tax_amount, 0) - COALESCE(fee_amount, 0))), 0)::text AS net_amount,
              COUNT(*)::integer AS event_count
         FROM spaartrack.income_event
        WHERE portfolio_id = $1 AND status = 'PAID' AND payment_date > ($2::date - interval '12 months') AND payment_date <= $2::date`,
      [portfolioId, asOf]
    );
    const padi = await databasePool.query(
      `SELECT COALESCE(SUM(forecast_amount_gross), 0)::text AS gross_amount,
              COALESCE(SUM(forecast_tax), 0)::text AS tax_amount,
              COALESCE(SUM(COALESCE(forecast_amount_net, forecast_amount_gross - forecast_tax)), 0)::text AS net_amount,
              COUNT(*)::integer AS forecast_count
         FROM spaartrack.dividend_forecast
        WHERE portfolio_id = $1 AND forecast_period_end >= $2::date AND forecast_period_start <= ($2::date + interval '12 months')`,
      [portfolioId, asOf]
    );
    const ttmRow = ttm.rows[0];
    const padiRow = padi.rows[0];
    json(res, 200, {
      portfolio_id: portfolioId,
      as_of: asOf,
      calculation_version: "dividend-income-v1",
      assumptions: { ttm: "PAID income_event payment_date in trailing 12 months", padi: "explicit dividend_forecast rows overlapping next 12 months" },
      ttm: { gross_amount: fixedAmount(Number(ttmRow.gross_amount)), tax_amount: fixedAmount(Number(ttmRow.tax_amount)), fee_amount: fixedAmount(Number(ttmRow.fee_amount)), net_amount: fixedAmount(Number(ttmRow.net_amount)), event_count: ttmRow.event_count },
      padi: { gross_amount: fixedAmount(Number(padiRow.gross_amount)), tax_amount: fixedAmount(Number(padiRow.tax_amount)), net_amount: fixedAmount(Number(padiRow.net_amount)), forecast_count: padiRow.forecast_count }
    });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "dividend_summary_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "DIVIDEND_SUMMARY_FAILED" });
  }
  return true;
}

async function dividendGrowthRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/dividend-growth")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
    const startDate = parsed.searchParams.get("start_date")?.trim() || "";
    const endDate = parsed.searchParams.get("end_date")?.trim() || "";
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
      json(res, 400, { error: "INVALID_DIVIDEND_GROWTH_QUERY" }); return true;
    }
    const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
    // Calendar year buckets are deliberately based on realized PAID income only.
    const result = await databasePool.query(
      `SELECT EXTRACT(YEAR FROM payment_date)::integer AS year,
              COALESCE(SUM(COALESCE(gross_amount, 0)), 0)::text AS gross_amount,
              COALESCE(SUM(COALESCE(tax_amount, 0)), 0)::text AS tax_amount,
              COALESCE(SUM(COALESCE(fee_amount, 0)), 0)::text AS fee_amount,
              COALESCE(SUM(COALESCE(net_amount, COALESCE(gross_amount, 0) - COALESCE(tax_amount, 0) - COALESCE(fee_amount, 0))), 0)::text AS net_amount,
              COUNT(*)::integer AS event_count
         FROM spaartrack.income_event
        WHERE portfolio_id = $1 AND status = 'PAID' AND payment_date >= $2::date AND payment_date <= $3::date
        GROUP BY EXTRACT(YEAR FROM payment_date)
        ORDER BY year`,
      [portfolioId, startDate, endDate]
    );
    const annualPeriods = result.rows.map((row) => ({
      period: String(row.year),
      gross_amount: fixedAmount(Number(row.gross_amount)),
      tax_amount: fixedAmount(Number(row.tax_amount)),
      fee_amount: fixedAmount(Number(row.fee_amount)),
      net_amount: fixedAmount(Number(row.net_amount)),
      event_count: row.event_count
    }));
    const growth = (from: number, to: number): string | null => from > 0 ? fixedAmount((to / from - 1) * 100) : null;
    const yoyFrom = annualPeriods.length >= 2 ? annualPeriods[annualPeriods.length - 2] : null;
    const yoyTo = annualPeriods.length >= 2 ? annualPeriods[annualPeriods.length - 1] : null;
    const cagrFrom = annualPeriods[0] || null;
    const cagrTo = annualPeriods[annualPeriods.length - 1] || null;
    const years = cagrFrom && cagrTo ? Number(cagrTo.period) - Number(cagrFrom.period) : 0;
    const cagrValue = cagrFrom && cagrTo && years > 0 && Number(cagrFrom.net_amount) > 0
      ? fixedAmount((Math.pow(Number(cagrTo.net_amount) / Number(cagrFrom.net_amount), 1 / years) - 1) * 100)
      : null;
    json(res, 200, {
      portfolio_id: portfolioId,
      period_start: startDate,
      period_end: endDate,
      calculation_version: "dividend-growth-v1",
      assumptions: "YoY compares the last two calendar-year PAID buckets; CAGR compares the first and last bucket over elapsed calendar years.",
      annual_periods: annualPeriods,
      yoy: { from_period: yoyFrom?.period || null, to_period: yoyTo?.period || null, net_growth: yoyFrom && yoyTo ? growth(Number(yoyFrom.net_amount), Number(yoyTo.net_amount)) : null },
      cagr: { from_period: cagrFrom?.period || null, to_period: cagrTo?.period || null, years: fixedAmount(years), net_growth: cagrValue }
    });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "dividend_growth_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "DIVIDEND_GROWTH_FAILED" });
  }
  return true;
}

const marketEventTypes = ["EX_DIVIDEND", "DIVIDEND_PAYMENT", "AGM", "EARNINGS", "TRADING_UPDATE", "CAPITAL_MARKETS_DAY", "ECONOMIC", "OTHER"] as const;
const marketEventColumns = `id, instrument_id, event_type, title, starts_at::text, ends_at::text, source, source_external_id, metadata`;

async function marketEventsRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/market-events")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const dateOrNull = (value: string | null): string | null => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
    if (req.method === "GET" && parsed.pathname === "/api/v1/market-events") {
      const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
      const startDate = dateOrNull(parsed.searchParams.get("start_date"));
      const endDate = dateOrNull(parsed.searchParams.get("end_date"));
      const eventType = parsed.searchParams.get("event_type")?.trim().toUpperCase() || "";
      const instrumentId = parsed.searchParams.get("instrument_id")?.trim() || "";
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !startDate || !endDate || startDate > endDate || (eventType && !marketEventTypes.includes(eventType as typeof marketEventTypes[number])) || (instrumentId && !/^[0-9a-f-]{36}$/i.test(instrumentId))) {
        json(res, 400, { error: "INVALID_MARKET_EVENTS_QUERY" }); return true;
      }
      const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
      const values: unknown[] = [portfolioId, startDate, endDate];
      let clause = ` AND me.starts_at <= ($3::date + interval '1 day') AND COALESCE(me.ends_at, me.starts_at) >= $2::date
         AND (me.instrument_id IS NULL OR EXISTS (SELECT 1 FROM spaartrack.ledger_entry le JOIN spaartrack.ledger_transaction lt ON lt.id = le.ledger_transaction_id WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED' AND le.instrument_id = me.instrument_id))`;
      if (eventType) { values.push(eventType); clause += ` AND me.event_type = $${values.length}`; }
      if (instrumentId) { values.push(instrumentId); clause += ` AND me.instrument_id = $${values.length}`; }
      const result = await databasePool.query(`SELECT ${marketEventColumns} FROM spaartrack.market_event me WHERE 1=1${clause} ORDER BY me.starts_at NULLS LAST, me.id`, values);
      const events = result.rows;
      const counts: Record<string, number> = { total: events.length };
      for (const type of marketEventTypes) counts[type] = events.filter((event) => event.event_type === type).length;
      json(res, 200, { portfolio_id: portfolioId, start_date: startDate, end_date: endDate, events, counts, calculation_version: "market-events-v1" });
      return true;
    }
    if (req.method !== "POST" || parsed.pathname !== "/api/v1/market-events") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
    const body = await readJson(req);
    const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
    const instrumentId = typeof body.instrument_id === "string" && body.instrument_id.trim() ? body.instrument_id.trim() : null;
    const eventType = typeof body.event_type === "string" ? body.event_type.trim().toUpperCase() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const startsAt = typeof body.starts_at === "string" ? body.starts_at.trim() : "";
    const endsAt = typeof body.ends_at === "string" && body.ends_at.trim() ? body.ends_at.trim() : null;
    const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : null;
    const sourceExternalId = typeof body.source_external_id === "string" && body.source_external_id.trim() ? body.source_external_id.trim() : null;
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || (instrumentId !== null && !/^[0-9a-f-]{36}$/i.test(instrumentId)) || !marketEventTypes.includes(eventType as typeof marketEventTypes[number]) || !title || !/^\d{4}-\d{2}-\d{2}T/.test(startsAt) || (endsAt !== null && !/^\d{4}-\d{2}-\d{2}T/.test(endsAt))) {
      json(res, 400, { error: "INVALID_MARKET_EVENT_INPUT" }); return true;
    }
    const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL AND role IN ('OWNER', 'EDITOR')`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
    if (instrumentId) {
      const holding = await databasePool.query(`SELECT 1 FROM spaartrack.ledger_entry le JOIN spaartrack.ledger_transaction lt ON lt.id = le.ledger_transaction_id WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED' AND le.instrument_id = $2 LIMIT 1`, [portfolioId, instrumentId]);
      if (!holding.rowCount) { json(res, 404, { error: "PORTFOLIO_INSTRUMENT_NOT_FOUND" }); return true; }
    }
    const result = await databasePool.query(`INSERT INTO spaartrack.market_event (instrument_id, event_type, title, starts_at, ends_at, source, source_external_id, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${marketEventColumns}`, [instrumentId, eventType, title, startsAt, endsAt, source, sourceExternalId, JSON.stringify({ created_by: userId, portfolio_id: portfolioId })]);
    const event = result.rows[0];
    await auditEvent(req, res, userId, "CREATE", "MARKET_EVENT", String(event.id), { portfolio_id: portfolioId, event_type: eventType });
    json(res, 201, event);
    return true;
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "market_events_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "MARKET_EVENTS_FAILED" });
  }
  return true;
}

function annualizeReturn(returnPct: number | null, days: number): string | null {
  if (returnPct === null || days <= 0 || 1 + returnPct / 100 <= 0) return null;
  return fixedAmount((Math.pow(1 + returnPct / 100, 365 / days) - 1) * 100);
}

function xirr(cashflows: Array<{ amount: number; date: string }>, endValue: number, endDate: string): number | null {
  const flows = [...cashflows.map((flow) => ({ amount: -flow.amount, date: flow.date })), { amount: endValue, date: endDate }];
  if (!flows.some((flow) => flow.amount < 0) || !flows.some((flow) => flow.amount > 0)) return null;
  const base = new Date(endDate).getTime();
  const npv = (rate: number): number => flows.reduce((sum, flow) => {
    const years = (new Date(flow.date).getTime() - base) / (365 * 24 * 60 * 60 * 1000);
    return sum + flow.amount * Math.pow(1 + rate, years);
  }, 0);
  let low = -0.9999;
  let high = 1;
  while (npv(low) * npv(high) > 0 && high < 1_000_000) high *= 2;
  if (npv(low) * npv(high) > 0) return null;
  for (let index = 0; index < 100; index += 1) {
    const middle = (low + high) / 2;
    if (Math.abs(npv(middle)) < 0.0000001) return middle * 100;
    if (npv(low) * npv(middle) <= 0) high = middle;
    else low = middle;
  }
  return ((low + high) / 2) * 100;
}

async function riskContributionRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/risk-contributions")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
    const periodStart = parsed.searchParams.get("period_start")?.trim() || "";
    const periodEnd = parsed.searchParams.get("period_end")?.trim() || "";
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) { json(res, 400, { error: "INVALID_RISK_CONTRIBUTION_QUERY" }); return true; }
    const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
    const rows = await databasePool.query(`SELECT DISTINCT ON (ps.instrument_id) ps.instrument_id::text, i.name, i.asset_class, ps.portfolio_weight::text, snapshot.snapshot_at::text FROM spaartrack.position_snapshot ps JOIN spaartrack.portfolio_snapshot snapshot ON snapshot.id = ps.portfolio_snapshot_id JOIN spaartrack.instrument i ON i.id = ps.instrument_id WHERE snapshot.portfolio_id = $1 AND snapshot.snapshot_at::date BETWEEN $2::date AND $3::date AND COALESCE(ps.market_value, 0) > 0 ORDER BY ps.instrument_id, snapshot.snapshot_at DESC`, [portfolioId, periodStart, periodEnd]);
    if (!rows.rowCount) { json(res, 409, { error: "RISK_CONTRIBUTION_HOLDINGS_REQUIRED", required: { period_start: periodStart, period_end: periodEnd } }); return true; }
    const riskScores: Record<string, number> = { EQUITY: 1, FIXED_INCOME: 0.5, DERIVATIVE: 1.4, CRYPTO: 1.6, CASH: 0.1, REAL_ASSET: 0.7, LIABILITY: 0.2, OTHER: 0.8 };
    const holdings = rows.rows.map((row) => ({ holdingId: String(row.instrument_id), name: String(row.name), category: String(row.asset_class), portfolioWeight: Number(row.portfolio_weight || 0), riskScore: riskScores[String(row.asset_class)] ?? 0.8 }));
    const calculation = calculateRiskContributions(holdings);
    const persistedIds: string[] = [];
    for (const holding of calculation.holdings) {
      const inserted = await databasePool.query(`INSERT INTO spaartrack.risk_metric_snapshot (portfolio_id, instrument_id, period_start, period_end, risk_contribution, calculation_version) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [portfolioId, holding.holding_id, periodStart, periodEnd, holding.contribution_pct, calculation.methodology]);
      persistedIds.push(String(inserted.rows[0].id));
    }
    await auditEvent(req, res, userId, "CALCULATE", "RISK_CONTRIBUTION_SNAPSHOT", persistedIds[0], { portfolio_id: portfolioId, period_start: periodStart, period_end: periodEnd, methodology: calculation.methodology, holding_count: calculation.holdings.length });
    json(res, 200, { portfolio_id: portfolioId, period: { start: periodStart, end: periodEnd }, snapshot_as_of: rows.rows[0].snapshot_at, holdings: calculation.holdings, categories: calculation.categories, total_contribution_pct: calculation.total_contribution_pct, methodology: calculation.methodology, source: "position_snapshot", snapshot_ids: persistedIds });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "risk_contribution_failed", error: error instanceof Error ? error.message : String(error) }));
    if (!res.writableEnded) json(res, 400, { error: "RISK_CONTRIBUTION_REQUEST_FAILED" });
  }
  return true;
}

async function etfExposureRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || (!req.url?.startsWith("/api/v1/etf-exposure") && !req.url?.startsWith("/api/v1/instrument-lookthrough"))) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    if (req.method === "POST" && parsed.pathname === "/api/v1/instrument-lookthrough") {
      const body = await readJson(req);
      const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
      const etfInstrumentId = typeof body.etf_instrument_id === "string" ? body.etf_instrument_id.trim() : "";
      const source = typeof body.source === "string" ? body.source.trim() : "";
      const sourceVersion = typeof body.source_version === "string" ? body.source_version.trim() : "";
      const asOf = typeof body.as_of === "string" ? body.as_of.trim() : "";
      const components = Array.isArray(body.components) ? body.components : [];
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^[0-9a-f-]{36}$/i.test(etfInstrumentId) || !source || !sourceVersion || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !components.length) {
        json(res, 400, { error: "ETF_LOOKTHROUGH_SOURCE_REQUIRED" }); return true;
      }
      const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL AND role IN ('OWNER', 'EDITOR')`, [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
      const etf = await databasePool.query(`SELECT id, instrument_type FROM spaartrack.instrument WHERE id = $1`, [etfInstrumentId]);
      if (!etf.rowCount || etf.rows[0].instrument_type !== "ETF") { json(res, 400, { error: "ETF_INSTRUMENT_REQUIRED" }); return true; }
      const normalized = components.map((component) => ({
        underlying_instrument_id: typeof component.underlying_instrument_id === "string" && component.underlying_instrument_id.trim() ? component.underlying_instrument_id.trim() : null,
        underlying_name: typeof component.underlying_name === "string" ? component.underlying_name.trim() : "",
        weight: Number(component.weight),
        resolution_status: component.resolution_status === "RESOLVED" ? "RESOLVED" : "UNRESOLVED"
      }));
      if (normalized.some((component) => !component.underlying_name || !Number.isFinite(component.weight) || component.weight < 0 || component.weight > 1 || (component.resolution_status === "RESOLVED" ? !component.underlying_instrument_id : component.underlying_instrument_id))) {
        json(res, 400, { error: "INVALID_LOOKTHROUGH_COMPONENT" }); return true;
      }
      const totalWeight = normalized.reduce((sum, component) => sum + component.weight, 0);
      if (Math.abs(totalWeight - 1) > 0.000001) { json(res, 400, { error: "INVALID_LOOKTHROUGH_COMPONENT_TOTAL" }); return true; }
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM spaartrack.instrument_lookthrough_component WHERE etf_instrument_id = $1 AND source = $2 AND source_version = $3 AND as_of = $4`, [etfInstrumentId, source, sourceVersion, asOf]);
        const inserted: string[] = [];
        for (const component of normalized) {
          const result = await client.query(`INSERT INTO spaartrack.instrument_lookthrough_component (etf_instrument_id, underlying_instrument_id, underlying_name, weight, resolution_status, source, source_version, as_of) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`, [etfInstrumentId, component.underlying_instrument_id, component.underlying_name, component.weight, component.resolution_status, source, sourceVersion, asOf]);
          inserted.push(String(result.rows[0].id));
        }
        await client.query("COMMIT");
        await auditEvent(req, res, userId, "CREATE", "ETF_LOOKTHROUGH_SOURCE", inserted[0], { portfolio_id: portfolioId, etf_instrument_id: etfInstrumentId, source, source_version: sourceVersion, as_of: asOf, component_count: inserted.length });
        json(res, 201, { portfolio_id: portfolioId, etf_instrument_id: etfInstrumentId, source, source_version: sourceVersion, as_of: asOf, component_ids: inserted, calculation_version: "etf-look-through-source-v1" });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
      return true;
    }
    if (req.method !== "GET" || parsed.pathname !== "/api/v1/etf-exposure") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
    const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
    const periodStart = parsed.searchParams.get("period_start")?.trim() || "";
    const periodEnd = parsed.searchParams.get("period_end")?.trim() || "";
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) { json(res, 400, { error: "INVALID_ETF_EXPOSURE_QUERY" }); return true; }
    const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
    const rows = await databasePool.query(`SELECT DISTINCT ON (ps.instrument_id) ps.instrument_id::text, i.name, ps.portfolio_weight::text, snapshot.snapshot_at::text FROM spaartrack.position_snapshot ps JOIN spaartrack.portfolio_snapshot snapshot ON snapshot.id = ps.portfolio_snapshot_id JOIN spaartrack.instrument i ON i.id = ps.instrument_id WHERE snapshot.portfolio_id = $1 AND snapshot.snapshot_at::date BETWEEN $2::date AND $3::date AND i.instrument_type = 'ETF' AND COALESCE(ps.market_value, 0) > 0 ORDER BY ps.instrument_id, snapshot.snapshot_at DESC`, [portfolioId, periodStart, periodEnd]);
    if (!rows.rowCount) { json(res, 409, { error: "ETF_HOLDINGS_REQUIRED", required: { period_start: periodStart, period_end: periodEnd } }); return true; }
    const holdings = [];
    for (const row of rows.rows) {
      const sourceResult = await databasePool.query(`SELECT source, source_version, as_of::text FROM spaartrack.instrument_lookthrough_component WHERE etf_instrument_id = $1 AND as_of <= $2::date ORDER BY as_of DESC, id DESC LIMIT 1`, [row.instrument_id, periodEnd]);
      if (!sourceResult.rowCount) { json(res, 409, { error: "ETF_LOOKTHROUGH_SOURCE_REQUIRED", etf_instrument_id: row.instrument_id }); return true; }
      const source = sourceResult.rows[0];
      const components = await databasePool.query(`SELECT underlying_instrument_id::text, underlying_name, weight::text, resolution_status FROM spaartrack.instrument_lookthrough_component WHERE etf_instrument_id = $1 AND source = $2 AND source_version = $3 AND as_of = $4::date ORDER BY id`, [row.instrument_id, source.source, source.source_version, source.as_of]);
      holdings.push({ instrumentId: String(row.instrument_id), name: String(row.name), portfolioWeight: Number(row.portfolio_weight || 0), components: components.rows.map((component) => ({ holdingId: component.underlying_instrument_id ? String(component.underlying_instrument_id) : null, name: String(component.underlying_name), weight: Number(component.weight), resolved: component.resolution_status === "RESOLVED" })) });
    }
    const sources = await databasePool.query(`SELECT DISTINCT ON (etf_instrument_id) etf_instrument_id::text, source, source_version, as_of::text FROM spaartrack.instrument_lookthrough_component WHERE etf_instrument_id = ANY($1::uuid[]) AND as_of <= $2::date ORDER BY etf_instrument_id, as_of DESC, id DESC`, [holdings.map((holding) => holding.instrumentId), periodEnd]);
    const calculation = calculateEtfExposure({ source: String(sources.rows[0].source), sourceVersion: String(sources.rows[0].source_version), asOf: String(sources.rows[0].as_of), holdings });
    const snapshotIds: string[] = [];
    for (const holding of holdings) {
      const inserted = await databasePool.query(`INSERT INTO spaartrack.risk_metric_snapshot (portfolio_id, instrument_id, period_start, period_end, calculation_version) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [portfolioId, holding.instrumentId, periodStart, periodEnd, calculation.methodology]);
      snapshotIds.push(String(inserted.rows[0].id));
    }
    await auditEvent(req, res, userId, "CALCULATE", "ETF_LOOKTHROUGH_SNAPSHOT", snapshotIds[0], { portfolio_id: portfolioId, period_start: periodStart, period_end: periodEnd, source: calculation.source, source_version: calculation.source_version, as_of: calculation.as_of, methodology: calculation.methodology, unresolved_count: calculation.unresolved_holdings.length });
    json(res, 200, { portfolio_id: portfolioId, period: { start: periodStart, end: periodEnd }, etf_count: holdings.length, ...calculation, snapshot_ids: snapshotIds, source_type: "instrument_lookthrough_component" });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "etf_exposure_failed", error: error instanceof Error ? error.message : String(error) }));
    if (!res.writableEnded) json(res, 400, { error: "ETF_EXPOSURE_REQUEST_FAILED" });
  }
  return true;
}

async function allocationTargetsRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/allocation-targets")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) { json(res, 400, { error: "INVALID_ALLOCATION_TARGET_QUERY" }); return true; }
    const access = await databasePool.query(`SELECT role FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
    if (req.method === "GET") {
      const dimension = parsed.searchParams.get("dimension")?.trim().toUpperCase() || "";
      const params: string[] = [portfolioId];
      let where = "portfolio_id = $1";
      if (dimension) { params.push(dimension); where += " AND dimension = $2"; }
      const result = await databasePool.query(`SELECT dimension, target_key, target_label, target_percentage::text, calculation_version, updated_at::text FROM spaartrack.allocation_target WHERE ${where} ORDER BY dimension, target_key`, params);
      const grouped = new Map<string, Array<Record<string, unknown>>>();
      for (const row of result.rows) {
        const targets = grouped.get(String(row.dimension)) || [];
        targets.push({ key: String(row.target_key), label: String(row.target_label), target_percentage: Number(row.target_percentage) });
        grouped.set(String(row.dimension), targets);
      }
      json(res, 200, { portfolio_id: portfolioId, dimensions: [...grouped.entries()].map(([name, targets]) => ({ dimension: name, targets, total_percentage: Number(targets.reduce((sum, target) => sum + Number(target.target_percentage), 0).toFixed(4)), calculation_version: "allocation-targets-v1" })), calculation_version: "allocation-targets-v1", source: "allocation_target" });
      return true;
    }
    if (req.method !== "POST") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
    if (!["OWNER", "EDITOR"].includes(String(access.rows[0].role))) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
    const body = await readJson(req);
    const inputTargets = Array.isArray(body.targets) ? body.targets.map((target) => ({ key: String((target as Record<string, unknown>).key || ""), label: String((target as Record<string, unknown>).label || ""), targetPercentage: Number((target as Record<string, unknown>).target_percentage ?? (target as Record<string, unknown>).targetPercentage) })) : [];
    const validated = validateAllocationTargets({ dimension: String(body.dimension || ""), targets: inputTargets });
    const client = await databasePool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM spaartrack.allocation_target WHERE portfolio_id = $1 AND dimension = $2`, [portfolioId, validated.dimension]);
      for (const target of validated.targets) await client.query(`INSERT INTO spaartrack.allocation_target (portfolio_id, dimension, target_key, target_label, target_percentage, calculation_version) VALUES ($1, $2, $3, $4, $5, $6)`, [portfolioId, validated.dimension, target.key, target.label, target.target_percentage, validated.calculation_version]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
    await auditEvent(req, res, userId, "UPDATE", "ALLOCATION_TARGETS", portfolioId, { portfolio_id: portfolioId, dimension: validated.dimension, total_percentage: validated.total_percentage, target_count: validated.targets.length, calculation_version: validated.calculation_version });
    json(res, 201, { portfolio_id: portfolioId, ...validated, source: "allocation_target", read_only_projection: true });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "ALLOCATION_TARGETS_REQUEST_FAILED";
    if (["INVALID_ALLOCATION_DIMENSION", "ALLOCATION_TARGETS_REQUIRED", "DUPLICATE_ALLOCATION_TARGET", "INVALID_ALLOCATION_TARGET_PERCENTAGE", "ALLOCATION_TARGET_TOTAL_MUST_EQUAL_100"].includes(message)) { json(res, 400, { error: message }); return true; }
    console.error(redactedLog({ level: "error", operation: "allocation_targets_failed", error: message }));
    if (!res.writableEnded) json(res, 400, { error: "ALLOCATION_TARGETS_REQUEST_FAILED" });
  }
  return true;
}

async function screenerWatchlistRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/screener-watchlists")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    if (req.method === "GET") {
      const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
      if (portfolioId && !/^[0-9a-f-]{36}$/i.test(portfolioId)) { json(res, 400, { error: "INVALID_SCREENER_PORTFOLIO" }); return true; }
      const result = await databasePool.query(`SELECT id, portfolio_id, name, filters, calculation_version, created_at::text, updated_at::text FROM spaartrack.screener_watchlist WHERE user_id = $1 AND ($2 = '' OR portfolio_id = $2::uuid) ORDER BY updated_at DESC, id`, [userId, portfolioId]);
      json(res, 200, { watchlists: result.rows, calculation_version: "screener-watchlist-v1", source: "portfolio_snapshot + position_snapshot + risk_metric_snapshot", read_only: true });
      return true;
    }
    if (req.method !== "POST" || parsed.pathname !== "/api/v1/screener-watchlists") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
    const body = await readJson(req);
    const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : null;
    if (portfolioId && !/^[0-9a-f-]{36}$/i.test(portfolioId)) { json(res, 400, { error: "INVALID_SCREENER_PORTFOLIO" }); return true; }
    if (portfolioId) {
      const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL AND role IN ('OWNER', 'EDITOR')`, [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
    }
    const definition = buildScreenerDefinition({ name: String(body.name || ""), portfolioId, filters: body.filters as never });
    const inserted = await databasePool.query(`INSERT INTO spaartrack.screener_watchlist (user_id, portfolio_id, name, filters, calculation_version) VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING id, created_at::text, updated_at::text`, [userId, portfolioId, definition.name, JSON.stringify(definition.filters), definition.calculation_version]);
    const row = inserted.rows[0];
    await auditEvent(req, res, userId, "CREATE", "SCREENER_WATCHLIST", String(row.id), { portfolio_id: portfolioId, dimensions: Object.keys(definition.filters), calculation_version: definition.calculation_version, read_only: true });
    json(res, 201, { id: row.id, watchlist_id: row.id, portfolio_id: portfolioId, name: definition.name, filters: definition.filters, calculation_version: definition.calculation_version, created_at: row.created_at, updated_at: row.updated_at, source: "portfolio_snapshot + position_snapshot + risk_metric_snapshot", read_only: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SCREENER_WATCHLIST_REQUEST_FAILED";
    if (["INVALID_SCREENER_DEFINITION", "INVALID_SCREENER_NAME", "INVALID_SCREENER_FILTERS", "INVALID_SCREENER_FILTER_DIMENSION", "INVALID_SCREENER_FILTER", "INVALID_SCREENER_FILTER_FIELD", "INVALID_SCREENER_FILTER_OPERATOR", "INVALID_SCREENER_FILTER_VALUE", "SCREENER_FILTERS_REQUIRED"].includes(message)) { json(res, 400, { error: message }); return true; }
    console.error(redactedLog({ level: "error", operation: "screener_watchlist_failed", error: message }));
    if (!res.writableEnded) json(res, 400, { error: "SCREENER_WATCHLIST_REQUEST_FAILED" });
  }
  return true;
}

async function rebalanceSuggestionsRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/rebalance-suggestions")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
    const dimension = parsed.searchParams.get("dimension")?.trim().toUpperCase() || "ASSET_CLASS";
    const asOf = parsed.searchParams.get("as_of")?.trim() || "9999-12-31";
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !["ASSET_CLASS", "SECTOR", "REGION", "CURRENCY", "HOLDING"].includes(dimension) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) { json(res, 400, { error: "INVALID_REBALANCE_QUERY" }); return true; }
    const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
    const snapshot = await databasePool.query(`SELECT id, snapshot_at::text, portfolio_value::text, free_cash::text FROM spaartrack.portfolio_snapshot WHERE portfolio_id = $1 AND snapshot_at::date <= $2::date ORDER BY snapshot_at DESC, id DESC LIMIT 1`, [portfolioId, asOf]);
    if (!snapshot.rowCount) { json(res, 409, { error: "REBALANCE_SNAPSHOT_REQUIRED" }); return true; }
    const dimensionColumn = { ASSET_CLASS: "i.asset_class", SECTOR: "i.sector", REGION: "i.country_code", CURRENCY: "i.currency_code", HOLDING: "ps.instrument_id::text" }[dimension];
    const positions = await databasePool.query(`SELECT ${dimensionColumn} AS target_key, i.name, COALESCE(ps.reporting_value, ps.market_value, 0)::text AS current_value FROM spaartrack.position_snapshot ps JOIN spaartrack.instrument i ON i.id = ps.instrument_id WHERE ps.portfolio_snapshot_id = $1 AND COALESCE(ps.reporting_value, ps.market_value, 0) > 0`, [snapshot.rows[0].id]);
    const targets = await databasePool.query(`SELECT target_key, target_label, target_percentage::text FROM spaartrack.allocation_target WHERE portfolio_id = $1 AND dimension = $2 ORDER BY target_key`, [portfolioId, dimension]);
    if (!targets.rowCount) { json(res, 409, { error: "REBALANCE_TARGETS_REQUIRED", dimension }); return true; }
    const grouped = new Map<string, { key: string; label: string; currentValue: number }>();
    for (const row of positions.rows) { const key = String(row.target_key || "UNMAPPED"); const existing = grouped.get(key) || { key, label: String(row.name), currentValue: 0 }; existing.currentValue += Number(row.current_value || 0); grouped.set(key, existing); }
    if (dimension === "ASSET_CLASS" && Number(snapshot.rows[0].free_cash || 0) > 0) grouped.set("CASH", { key: "CASH", label: "Cash", currentValue: Number(snapshot.rows[0].free_cash) });
    const calculation = calculateDriftRebalance({ dimension, portfolioValue: Number(snapshot.rows[0].portfolio_value), holdings: [...grouped.values()], targets: targets.rows.map((row) => ({ key: String(row.target_key), label: String(row.target_label), targetPercentage: Number(row.target_percentage) })), cashAvailable: Number(snapshot.rows[0].free_cash || 0) });
    await auditEvent(req, res, userId, "CALCULATE", "DRIFT_REBALANCE_SNAPSHOT", portfolioId, { portfolio_id: portfolioId, dimension, snapshot_as_of: snapshot.rows[0].snapshot_at, calculation_version: calculation.calculation_version, suggestion_count: calculation.suggestions.length });
    json(res, 200, { portfolio_id: portfolioId, snapshot_as_of: snapshot.rows[0].snapshot_at, portfolio_value: Number(snapshot.rows[0].portfolio_value), ...calculation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REBALANCE_REQUEST_FAILED";
    if (["ALLOCATION_TARGET_TOTAL_MUST_EQUAL_100", "INVALID_REBALANCE_PORTFOLIO_VALUE"].includes(message)) { json(res, 400, { error: message }); return true; }
    console.error(redactedLog({ level: "error", operation: "rebalance_suggestions_failed", error: message }));
    if (!res.writableEnded) json(res, 400, { error: "REBALANCE_REQUEST_FAILED" });
  }
  return true;
}

async function riskMetricsRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/risk-metrics")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
    const benchmarkId = parsed.searchParams.get("benchmark_id")?.trim() || "";
    const periodStart = parsed.searchParams.get("period_start")?.trim() || "";
    const periodEnd = parsed.searchParams.get("period_end")?.trim() || "";
    const riskFreeAnnual = Number(parsed.searchParams.get("risk_free_annual") || "0.02");
    const periodsPerYear = Number(parsed.searchParams.get("periods_per_year") || "12");
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^[0-9a-f-]{36}$/i.test(benchmarkId) || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) {
      json(res, 400, { error: "INVALID_RISK_METRICS_QUERY" }); return true;
    }
    const access = await databasePool.query(`SELECT p.reporting_currency_code FROM spaartrack.portfolio p JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = p.id WHERE p.id = $1 AND pm.user_id = $2 AND pm.revoked_at IS NULL`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
    const benchmark = await databasePool.query(`SELECT id, name, symbol, currency_code FROM spaartrack.benchmark WHERE id = $1 AND is_active = true`, [benchmarkId]);
    if (!benchmark.rowCount) { json(res, 404, { error: "BENCHMARK_NOT_FOUND" }); return true; }
    const snapshots = await databasePool.query(`SELECT snapshot_at::text, portfolio_value::text FROM spaartrack.portfolio_snapshot WHERE portfolio_id = $1 AND snapshot_at::date BETWEEN $2::date AND $3::date ORDER BY snapshot_at`, [portfolioId, periodStart, periodEnd]);
    const observations = await databasePool.query(`SELECT observed_at::text, index_value::text FROM spaartrack.benchmark_observation WHERE benchmark_id = $1 AND observed_at BETWEEN $2::date AND $3::date ORDER BY observed_at`, [benchmarkId, periodStart, periodEnd]);
    if (snapshots.rows.length < 2 || observations.rows.length < 2) {
      json(res, 409, { error: "RISK_OBSERVATIONS_REQUIRED", required: { period_start: periodStart, period_end: periodEnd, minimum_observations: 2 } }); return true;
    }
    const portfolioReturns: Array<number | null> = [];
    for (let index = 1; index < snapshots.rows.length; index += 1) {
      const previous = Number(snapshots.rows[index - 1].portfolio_value);
      const current = Number(snapshots.rows[index].portfolio_value);
      portfolioReturns.push(previous > 0 && Number.isFinite(current) ? current / previous - 1 : null);
    }
    const benchmarkReturns: Array<number | null> = [];
    for (let index = 1; index < observations.rows.length; index += 1) {
      const previous = Number(observations.rows[index - 1].index_value);
      const current = Number(observations.rows[index].index_value);
      benchmarkReturns.push(previous > 0 && Number.isFinite(current) ? current / previous - 1 : null);
    }
    const metrics = calculateRiskMetrics({ periodStart, periodEnd, portfolioReturns, benchmarkReturns, riskFreeAnnual, periodsPerYear });
    const persisted = await databasePool.query(`INSERT INTO spaartrack.risk_metric_snapshot (portfolio_id, period_start, period_end, volatility, beta, sharpe, sortino, max_drawdown, calculation_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, created_at`, [portfolioId, periodStart, periodEnd, metrics.volatility_pct === null ? null : metrics.volatility_pct, metrics.beta, metrics.sharpe, metrics.sortino, metrics.max_drawdown_pct, metrics.calculation_version]);
    const result = { portfolio_id: portfolioId, period: { start: periodStart, end: periodEnd }, observations: metrics.observations, metrics: { volatility_pct: metrics.volatility_pct, beta: metrics.beta, max_drawdown_pct: metrics.max_drawdown_pct, sharpe: metrics.sharpe, sortino: metrics.sortino }, benchmark: benchmark.rows[0], assumptions: metrics.assumptions, calculation_version: metrics.calculation_version, source: "portfolio_snapshot + benchmark_observation", snapshot_id: persisted.rows[0].id, created_at: persisted.rows[0].created_at };
    await auditEvent(req, res, userId, "CALCULATE", "RISK_METRIC_SNAPSHOT", String(persisted.rows[0].id), { portfolio_id: portfolioId, benchmark_id: benchmarkId, calculation_version: metrics.calculation_version, observations: metrics.observations });
    json(res, 200, result);
  } catch (error) {
    const traced = res as TracedResponse;
    console.error(redactedLog({ level: "error", operation: "risk_metrics_failed", trace_id: traced.trace_id || traceId(req), correlation_id: traced.correlation_id || correlationId(req), error: error instanceof Error ? error.message : String(error) }));
    if (!res.writableEnded) json(res, 400, { error: "RISK_METRICS_REQUEST_FAILED" });
  }
  return true;
}

async function portfolioComparisonRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/portfolio-comparisons")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const portfolioIds = [...new Set((parsed.searchParams.get("portfolio_ids") || "").split(",").map((value) => value.trim()).filter(Boolean))];
    const periodStart = parsed.searchParams.get("period_start")?.trim() || "";
    const periodEnd = parsed.searchParams.get("period_end")?.trim() || "";
    if (portfolioIds.length < 2 || portfolioIds.length > 4 || portfolioIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id)) || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart >= periodEnd) { json(res, 400, { error: "INVALID_PORTFOLIO_COMPARISON_QUERY" }); return true; }
    const access = await databasePool.query(`SELECT p.id, p.name, p.reporting_currency_code FROM spaartrack.portfolio p JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = p.id WHERE p.id = ANY(string_to_array($1, ',')::uuid[]) AND pm.user_id = $2 AND pm.revoked_at IS NULL`, [portfolioIds.join(","), userId]);
    if (access.rowCount !== portfolioIds.length) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
    const portfolios = [];
    for (const portfolioId of portfolioIds) {
      const row = access.rows.find((item) => String(item.id) === portfolioId);
      const snapshots = await databasePool.query(`SELECT snapshot_at::text, portfolio_value::text, free_cash::text FROM spaartrack.portfolio_snapshot WHERE portfolio_id = $1 AND snapshot_at::date IN ($2::date, $3::date) ORDER BY snapshot_at`, [portfolioId, periodStart, periodEnd]);
      const start = snapshots.rows.find((item) => String(item.snapshot_at).slice(0, 10) === periodStart);
      const end = snapshots.rows.find((item) => String(item.snapshot_at).slice(0, 10) === periodEnd);
      if (!start || !end) { json(res, 409, { error: "COMPARISON_SNAPSHOTS_REQUIRED", portfolio_id: portfolioId }); return true; }
      const positions = await databasePool.query(`SELECT i.asset_class, COALESCE(ps.reporting_value, ps.market_value, 0)::text AS value FROM spaartrack.position_snapshot ps JOIN spaartrack.instrument i ON i.id = ps.instrument_id JOIN spaartrack.portfolio_snapshot snapshot ON snapshot.id = ps.portfolio_snapshot_id WHERE snapshot.portfolio_id = $1 AND snapshot.snapshot_at::date = $2::date`, [portfolioId, periodEnd]);
      const total = Number(end.portfolio_value || 0);
      const allocation: Record<string, number> = {};
      for (const position of positions.rows) { const key = String(position.asset_class || "OTHER"); allocation[key] = (allocation[key] || 0) + (total > 0 ? Number(position.value || 0) / total : 0); }
      const freeCash = Number(end.free_cash || 0);
      if (total > 0 && freeCash > 0) allocation.CASH = (allocation.CASH || 0) + freeCash / total;
      const flows = await databasePool.query(`SELECT lt.activity_type, le.amount::text FROM spaartrack.ledger_transaction lt JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED' AND lt.is_external_flow = true AND lt.effective_date > $2::date AND lt.effective_date <= $3::date AND lt.activity_type IN ('DEPOSIT', 'WITHDRAWAL')`, [portfolioId, periodStart, periodEnd]);
      const netCashFlow = flows.rows.reduce((sum, flow) => sum + (String(flow.activity_type) === "WITHDRAWAL" ? -1 : 1) * Number(flow.amount || 0), 0);
      const risk = await databasePool.query(`SELECT volatility::text, max_drawdown::text, sharpe::text FROM spaartrack.risk_metric_snapshot WHERE portfolio_id = $1 AND period_start = $2::date AND period_end = $3::date ORDER BY created_at DESC LIMIT 1`, [portfolioId, periodStart, periodEnd]);
      const riskRow = risk.rows[0] || {};
      portfolios.push({ id: portfolioId, name: String(row.name), currency: String(row.reporting_currency_code).trim(), startValue: Number(start.portfolio_value || 0), endValue: total, netCashFlow, allocation, risk: { volatilityPct: riskRow.volatility == null ? null : Number(riskRow.volatility), maxDrawdownPct: riskRow.max_drawdown == null ? null : Number(riskRow.max_drawdown), sharpe: riskRow.sharpe == null ? null : Number(riskRow.sharpe) } });
    }
    const result = comparePortfolios({ periodStart, periodEnd, portfolios });
    await auditEvent(req, res, userId, "CALCULATE", "PORTFOLIO_COMPARISON", portfolioIds[0], { portfolio_ids: portfolioIds, period_start: periodStart, period_end: periodEnd, calculation_version: result.calculationVersion });
    json(res, 200, { ...result, portfolio_ids: portfolioIds, source: "portfolio_snapshot + position_snapshot + risk_metric_snapshot", read_only: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PORTFOLIO_COMPARISON_FAILED";
    if (["INVALID_COMPARISON_PERIOD", "COMPARISON_PORTFOLIOS_REQUIRED", "COMPARISON_CURRENCY_MISMATCH", "INVALID_COMPARISON_PORTFOLIO", "INVALID_COMPARISON_ALLOCATION"].includes(message)) { json(res, 400, { error: message }); return true; }
    console.error(redactedLog({ level: "error", operation: "portfolio_comparison_failed", error: message }));
    if (!res.writableEnded) json(res, 400, { error: "PORTFOLIO_COMPARISON_FAILED" });
  }
  return true;
}

async function backtestScenarioRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/backtest-scenarios")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "POST" || req.url !== "/api/v1/backtest-scenarios") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const body = await readJson(req);
    const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "What-if scenario";
    if (portfolioId && !/^[0-9a-f-]{36}$/i.test(portfolioId)) { json(res, 400, { error: "INVALID_BACKTEST_PORTFOLIO" }); return true; }
    if (portfolioId) {
      const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
    }
    const calculation = runWhatIfBacktest({
      periodStart: String(body.period_start || ""), periodEnd: String(body.period_end || ""),
      allocations: (body.allocations && typeof body.allocations === "object" ? body.allocations : {}) as Record<string, number>,
      initialCapital: Number(body.initial_capital), priceSeries: Array.isArray(body.price_series) ? body.price_series as never[] : [],
      cashflows: Array.isArray(body.cashflows) ? body.cashflows as never[] : [], costs: body.costs as never, assumptions: body.assumptions as Record<string, unknown> | undefined,
    });
    const persisted = await databasePool.query(`INSERT INTO spaartrack.backtest_scenario (user_id, portfolio_id, name, period_start, period_end, assumptions, allocations, results, status) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, 'SUCCEEDED') RETURNING id, created_at`, [userId, portfolioId || null, name, calculation.period.start, calculation.period.end, JSON.stringify({ ...calculation.assumptions, costs: calculation.costs, input_prices: calculation.input_prices, cashflows: calculation.cashflows, calculation_version: calculation.calculation_version }), JSON.stringify(calculation.allocations), JSON.stringify(calculation.result)]);
    const scenarioId = String(persisted.rows[0].id);
    await auditEvent(req, res, userId, "CALCULATE", "BACKTEST_SCENARIO", scenarioId, { portfolio_id: portfolioId || null, scenario_id: scenarioId, calculation_version: calculation.calculation_version, observations: calculation.observations.length });
    json(res, 201, { scenario_id: scenarioId, name, status: "SUCCEEDED", ...calculation, created_at: persisted.rows[0].created_at, source: "portfolio_snapshot + instrument_price + ledger_cashflow", read_only: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "BACKTEST_SCENARIO_FAILED";
    if (["INVALID_BACKTEST_PERIOD", "INVALID_INITIAL_CAPITAL", "ALLOCATIONS_MUST_EQUAL_100", "BACKTEST_BOUNDARY_PRICES_REQUIRED", "INVALID_BACKTEST_PRICE_DATE", "INVALID_BACKTEST_PRICE", "INVALID_BACKTEST_COSTS", "INVALID_BACKTEST_CASHFLOW"].includes(message)) { json(res, 400, { error: message }); return true; }
    console.error(redactedLog({ level: "error", operation: "backtest_scenario_failed", error: message }));
    if (!res.writableEnded) json(res, 400, { error: "BACKTEST_SCENARIO_FAILED" });
  }
  return true;
}

async function bondPricingRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/bond-metrics")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const instrumentId = parsed.searchParams.get("instrument_id")?.trim() || "";
    if (!/^[0-9a-f-]{36}$/i.test(instrumentId)) { json(res, 400, { error: "INVALID_BOND_METRICS_QUERY" }); return true; }
    const profileResult = await databasePool.query(
      `SELECT bp.instrument_id::text, bp.issuer_type, bp.issuer_name, bp.coupon_rate::text, bp.coupon_frequency,
              bp.issue_date::text, bp.maturity_date::text, bp.face_value::text, bp.day_count_convention,
              i.currency_code, i.name AS instrument_name
         FROM spaartrack.bond_profile bp
         JOIN spaartrack.instrument i ON i.id = bp.instrument_id
        WHERE bp.instrument_id = $1`,
      [instrumentId]
    );
    if (!profileResult.rowCount) { json(res, 404, { error: "BOND_PROFILE_NOT_FOUND" }); return true; }
    const row = profileResult.rows[0];
    const profile: BondProfileInput = {
      issuerType: String(row.issuer_type), issuerName: String(row.issuer_name), couponRate: Number(row.coupon_rate),
      couponFrequency: String(row.coupon_frequency), issueDate: String(row.issue_date), maturityDate: String(row.maturity_date),
      faceValue: Number(row.face_value), currencyCode: String(row.currency_code), dayCountConvention: String(row.day_count_convention || "ACT_365")
    };
    const yieldParam = parsed.searchParams.get("yield_rate");
    const priceParam = parsed.searchParams.get("dirty_price");
    const metrics = calculateBondMetrics({
      profile,
      settlementDate: parsed.searchParams.get("settlement_date")?.trim() || "",
      yieldRate: yieldParam === null || yieldParam === "" ? undefined : yieldParam,
      dirtyPrice: priceParam === null || priceParam === "" ? undefined : priceParam
    });
    await auditEvent(req, res, userId, "CALCULATE", "BOND_PRICING", instrumentId, {
      instrument_id: instrumentId, calculation_version: metrics.calculation_version,
      yield_source: metrics.yield_source, yield_rate: metrics.yield_rate, settlement_date: metrics.settlement_date
    });
    json(res, 200, { instrument_id: instrumentId, instrument_name: String(row.instrument_name), ...metrics });
    return true;
  } catch (error) {
    const message = (error as Error).message;
    if (["INVALID_BOND_PRICING_INPUT", "INVALID_BOND_YIELD", "INVALID_BOND_PRICE", "SETTLEMENT_OUT_OF_RANGE", "INVALID_BOND_PROFILE", "YTM_NOT_FOUND"].includes(message)) { json(res, 400, { error: message }); return true; }
    console.error(redactedLog({ level: "error", operation: "bond_pricing_failed", trace_id: traceId(req), correlation_id: correlationId(req), error: message }));
    if (!res.writableEnded) json(res, 400, { error: "BOND_PRICING_FAILED" });
    return true;
  }
}

async function bondCurveScenarioRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/bond-curve-scenarios")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "POST") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const body = await readJson(req);
    const scenario = buildBondCurveScenario({
      curve: Array.isArray(body.curve) ? body.curve.map((item) => ({ tenorDays: ((item as Record<string, unknown>).tenor_days ?? (item as Record<string, unknown>).tenorDays) as number | string, zeroRate: ((item as Record<string, unknown>).zero_rate ?? (item as Record<string, unknown>).zeroRate) as number | string })) : [],
      parallelShift: (body.parallel_shift ?? body.parallelShift) as number | string | undefined,
      asOfDate: body.as_of_date as string | undefined,
      currencyCode: body.currency_code as string | undefined
    });
    const scenarioId = randomUUID();
    await auditEvent(req, res, userId, "CALCULATE", "BOND_CURVE_SCENARIO", scenarioId, {
      scenario_id: scenarioId,
      calculation_version: scenario.calculation_version,
      observation_count: scenario.observations.length,
      parallel_shift: scenario.parallel_shift
    });
    json(res, 200, { scenario_id: scenarioId, ...scenario });
  } catch (error) {
    const message = (error as Error).message;
    if (["INVALID_BOND_CURVE", "INVALID_BOND_CURVE_SHIFT", "INVALID_BOND_CURVE_DATE", "INVALID_BOND_CURVE_CURRENCY"].includes(message)) { json(res, 400, { error: message }); return true; }
    console.error(redactedLog({ level: "error", operation: "bond_curve_scenario_failed", trace_id: traceId(req), correlation_id: correlationId(req), error: message }));
    if (!res.writableEnded) json(res, 400, { error: "BOND_CURVE_SCENARIO_FAILED" });
  }
  return true;
}

function bondCashflowRow(row: Record<string, string>): BondCashflowEntry {
  return { payment_date: String(row.payment_date), cashflow_type: String(row.cashflow_type) as "COUPON" | "PRINCIPAL", amount: fixedAmount(Number(row.amount)), currency_code: String(row.currency_code) };
}

async function bondProfileRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/bond-profiles")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }

  const profileMatch = req.url?.match(/\/api\/v1\/bond-profiles\/([0-9a-f-]{36})(\/cashflows)?$/i);
  if (profileMatch) {
    const instrumentId = profileMatch[1];
    const wantsCashflows = Boolean(profileMatch[2]);
    const profileResult = await databasePool.query(
      `SELECT bp.instrument_id::text, bp.issuer_type, bp.issuer_name, bp.coupon_rate::text, bp.coupon_frequency,
              bp.issue_date::text, bp.maturity_date::text, bp.face_value::text, bp.day_count_convention,
              bp.benchmark_spread::text, bp.credit_rating,
              i.name AS instrument_name, i.currency_code
         FROM spaartrack.bond_profile bp
         JOIN spaartrack.instrument i ON i.id = bp.instrument_id
        WHERE bp.instrument_id = $1`,
      [instrumentId]
    );
    if (wantsCashflows && req.method === "POST") {
      if (!profileResult.rowCount) { json(res, 404, { error: "BOND_PROFILE_NOT_FOUND" }); return true; }
      try {
        const row = profileResult.rows[0];
        const profile: BondProfileInput = {
          issuerType: String(row.issuer_type), issuerName: String(row.issuer_name), couponRate: Number(row.coupon_rate),
          couponFrequency: String(row.coupon_frequency), issueDate: String(row.issue_date), maturityDate: String(row.maturity_date),
          faceValue: Number(row.face_value), currencyCode: String(row.currency_code), dayCountConvention: String(row.day_count_convention || "ACT_365")
        };
        const calculation = generateBondCashflows(profile);
        const client = await databasePool.connect();
        try {
          await client.query("BEGIN");
          await client.query(`DELETE FROM spaartrack.bond_cashflow WHERE instrument_id = $1`, [instrumentId]);
          for (const flow of calculation.cashflows) {
            await client.query(
              `INSERT INTO spaartrack.bond_cashflow (instrument_id, payment_date, amount, currency_code, cashflow_type)
               VALUES ($1, $2, $3, $4, $5)`,
              [instrumentId, flow.payment_date, flow.amount, flow.currency_code, flow.cashflow_type]
            );
          }
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
        await auditEvent(req, res, userId, "CALCULATE", "BOND_CASHFLOW", instrumentId, { instrument_id: instrumentId, calculation_version: calculation.calculation_version, cashflow_count: calculation.cashflows.length });
        json(res, 201, { instrument_id: instrumentId, instrument_name: String(row.instrument_name), ...calculation });
        return true;
      } catch (error) {
        console.error(redactedLog({ level: "error", operation: "bond_cashflow_failed", trace_id: traceId(req), correlation_id: correlationId(req), error: (error as Error).message }));
        if (!res.writableEnded) json(res, 400, { error: "BOND_CASHFLOW_FAILED" });
        return true;
      }
    }
    if (wantsCashflows && req.method === "GET") {
      if (!profileResult.rowCount) { json(res, 404, { error: "BOND_PROFILE_NOT_FOUND" }); return true; }
      const cashflowRows = await databasePool.query(
        `SELECT payment_date::text, cashflow_type, amount::text, currency_code
           FROM spaartrack.bond_cashflow
          WHERE instrument_id = $1
          ORDER BY payment_date, CASE WHEN cashflow_type = 'COUPON' THEN 0 ELSE 1 END`,
        [instrumentId]
      );
      const cashflows = (cashflowRows.rows as Array<Record<string, string>>).map(bondCashflowRow);
      const couponTotal = cashflows.filter((flow) => flow.cashflow_type === "COUPON").reduce((sum, flow) => sum + Number(flow.amount), 0);
      const principalTotal = cashflows.filter((flow) => flow.cashflow_type === "PRINCIPAL").reduce((sum, flow) => sum + Number(flow.amount), 0);
      json(res, 200, {
        instrument_id: instrumentId,
        cashflows,
        cashflow_count: cashflows.length,
        totals: { coupon_total: fixedAmount(couponTotal), principal_total: fixedAmount(principalTotal), grand_total: fixedAmount(couponTotal + principalTotal) },
        calculation_version: "bond-cashflow-v1",
        source: "bond_profile",
        read_only: true
      });
      return true;
    }
    if (!wantsCashflows && req.method === "GET") {
      if (!profileResult.rowCount) { json(res, 404, { error: "BOND_PROFILE_NOT_FOUND" }); return true; }
      const row = profileResult.rows[0];
      json(res, 200, {
        instrument_id: String(row.instrument_id),
        instrument_name: String(row.instrument_name),
        currency_code: String(row.currency_code),
        issuer_type: String(row.issuer_type),
        issuer_name: String(row.issuer_name),
        coupon_rate: fixedAmount(Number(row.coupon_rate)),
        coupon_frequency: String(row.coupon_frequency),
        maturity_date: String(row.maturity_date),
        day_count_convention: String(row.day_count_convention || "ACT_365"),
        benchmark_spread: row.benchmark_spread === null ? null : fixedAmount(Number(row.benchmark_spread)),
        credit_rating: row.credit_rating,
        calculation_version: "bond-profile-v1",
        read_only: true
      });
      return true;
    }
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/v1/bond-profiles") {
    try {
      const body = await readJson(req);
      const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
      const instrumentId = typeof body.instrument_id === "string" ? body.instrument_id.trim() : "";
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^[0-9a-f-]{36}$/i.test(instrumentId)) { json(res, 400, { error: "INVALID_BOND_PROFILE_INPUT" }); return true; }
      const profile: BondProfileInput = {
        issuerType: typeof body.issuer_type === "string" ? body.issuer_type : String(body.issuer_type || ""),
        issuerName: typeof body.issuer_name === "string" ? body.issuer_name : String(body.issuer_name || ""),
        couponRate: (body.coupon_rate ?? NaN) as string | number,
        couponFrequency: typeof body.coupon_frequency === "string" ? body.coupon_frequency : String(body.coupon_frequency || ""),
        issueDate: typeof body.issue_date === "string" ? body.issue_date : "0000-00-00",
        maturityDate: typeof body.maturity_date === "string" ? body.maturity_date : "0000-00-00",
        faceValue: (body.face_value ?? NaN) as string | number,
        currencyCode: typeof body.currency_code === "string" ? body.currency_code : String(body.currency_code || ""),
        dayCountConvention: typeof body.day_count_convention === "string" ? body.day_count_convention : undefined
      };
      const validated = validateBondProfile(profile);
      const membership = await databasePool.query(`SELECT role FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
      if (!membership.rowCount || !["OWNER", "EDITOR"].includes(String(membership.rows[0].role))) { json(res, 403, { error: "BOND_PROFILE_FORBIDDEN" }); return true; }
      const instrument = await databasePool.query(`SELECT id::text, instrument_type FROM spaartrack.instrument WHERE id = $1`, [instrumentId]);
      if (!instrument.rowCount) { json(res, 404, { error: "INSTRUMENT_NOT_FOUND" }); return true; }
      if (String(instrument.rows[0].instrument_type) !== "BOND") { json(res, 400, { error: "INSTRUMENT_TYPE_NOT_BOND" }); return true; }
      const inserted = await databasePool.query(
        `INSERT INTO spaartrack.bond_profile (instrument_id, issuer_type, issuer_name, coupon_rate, coupon_frequency, issue_date, maturity_date, face_value, day_count_convention)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (instrument_id) DO NOTHING
         RETURNING instrument_id`,
        [instrumentId, validated.issuer_type, validated.issuer_name, validated.coupon_rate, validated.coupon_frequency, validated.issue_date, validated.maturity_date, validated.face_value, validated.day_count_convention]
      );
      if (!inserted.rowCount) { json(res, 409, { error: "BOND_PROFILE_ALREADY_EXISTS" }); return true; }
      await auditEvent(req, res, userId, "REGISTER", "BOND_PROFILE", instrumentId, { portfolio_id: portfolioId, instrument_id: instrumentId, calculation_version: validated.calculation_version, issuer_type: validated.issuer_type, coupon_frequency: validated.coupon_frequency, maturity_date: validated.maturity_date });
      json(res, 201, { portfolio_id: portfolioId, instrument_id: instrumentId, ...validated, benchmark_spread: null, credit_rating: null, read_only: true });
      return true;
    } catch (error) {
      const message = (error as Error).message;
      if (message === "INVALID_BOND_PROFILE") { json(res, 400, { error: "INVALID_BOND_PROFILE" }); return true; }
      if (message === "invalid_json") { json(res, 400, { error: "INVALID_BOND_PROFILE_REQUEST" }); return true; }
      console.error(redactedLog({ level: "error", operation: "bond_profile_failed", trace_id: traceId(req), correlation_id: correlationId(req), error: message }));
      if (!res.writableEnded) json(res, 400, { error: "BOND_PROFILE_REQUEST_FAILED" });
      return true;
    }
  }

  if (req.method === "GET" && req.url === "/api/v1/bond-profiles") {
    const result = await databasePool.query(
      `SELECT bp.instrument_id::text AS instrument_id, bp.issuer_type, bp.issuer_name, bp.coupon_rate::text, bp.coupon_frequency,
              bp.maturity_date::text, bp.day_count_convention, i.name AS instrument_name, i.currency_code
         FROM spaartrack.bond_profile bp
         JOIN spaartrack.instrument i ON i.id = bp.instrument_id
        ORDER BY i.name, bp.instrument_id`
    );
    const profiles = (result.rows as Array<Record<string, string>>).map((row) => ({
      instrument_id: String(row.instrument_id),
      instrument_name: String(row.instrument_name),
      currency_code: String(row.currency_code),
      issuer_type: String(row.issuer_type),
      issuer_name: String(row.issuer_name),
      coupon_rate: fixedAmount(Number(row.coupon_rate)),
      coupon_frequency: String(row.coupon_frequency),
      maturity_date: String(row.maturity_date),
      day_count_convention: String(row.day_count_convention || "ACT_365")
    }));
    json(res, 200, { profiles, count: profiles.length, calculation_version: "bond-profile-v1", read_only: true });
    return true;
  }

  json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  return true;
}

function optionContractRow(row: Record<string, unknown>) {
  const stored = (value: unknown): string | null => (value === null || value === undefined ? null : fixedAmount(Number(value)));
  return {
    instrument_id: String(row.instrument_id),
    instrument_name: String(row.instrument_name),
    currency_code: String(row.currency_code),
    underlying_instrument_id: String(row.underlying_instrument_id),
    underlying_instrument_name: String(row.underlying_instrument_name),
    option_type: String(row.option_type),
    strike_price: fixedAmount(Number(row.strike_price)),
    expiry_at: new Date(row.expiry_at as string).toISOString(),
    contract_multiplier: fixedAmount(Number(row.contract_multiplier)),
    implied_volatility: stored(row.implied_volatility),
    greeks: {
      delta: stored(row.delta),
      gamma: stored(row.gamma),
      theta: stored(row.theta),
      vega: stored(row.vega),
      rho: stored(row.rho)
    }
  };
}

async function optionLifecycleEvents(instrumentId: string): Promise<OptionLifecycleEventInput[]> {
  const result = await databasePool.query(
    `SELECT event_type, occurred_at FROM spaartrack.option_lifecycle_event WHERE option_instrument_id = $1 ORDER BY occurred_at`,
    [instrumentId]
  );
  return (result.rows as Array<Record<string, unknown>>).map((row) => ({
    event_type: String(row.event_type),
    occurred_at: new Date(row.occurred_at as string).toISOString()
  }));
}

async function optionLifecycleEventsByInstrument(instrumentIds: string[]): Promise<Map<string, OptionLifecycleEventInput[]>> {
  const events = new Map<string, OptionLifecycleEventInput[]>();
  if (instrumentIds.length === 0) return events;
  const result = await databasePool.query(
    `SELECT option_instrument_id::text AS option_instrument_id, event_type, occurred_at FROM spaartrack.option_lifecycle_event WHERE option_instrument_id = ANY($1::uuid[]) ORDER BY occurred_at`,
    [instrumentIds]
  );
  for (const row of result.rows as Array<Record<string, unknown>>) {
    const key = String(row.option_instrument_id);
    const list = events.get(key) ?? [];
    list.push({ event_type: String(row.event_type), occurred_at: new Date(row.occurred_at as string).toISOString() });
    events.set(key, list);
  }
  return events;
}

async function optionContractRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/option-contracts")) return false;

  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }

  const detailMatch = req.url.match(/^\/api\/v1\/option-contracts\/([0-9a-f-]{36})$/i);
  if (detailMatch && req.method === "GET") {
    const instrumentId = detailMatch[1];
    const result = await databasePool.query(
      `SELECT oc.instrument_id::text AS instrument_id, i.name AS instrument_name, i.currency_code,
              oc.underlying_instrument_id::text AS underlying_instrument_id, u.name AS underlying_instrument_name,
              oc.option_type, oc.strike_price::text, oc.expiry_at, oc.contract_multiplier::text, oc.implied_volatility::text,
              oc.delta::text, oc.gamma::text, oc.theta::text, oc.vega::text, oc.rho::text
         FROM spaartrack.option_contract oc
         JOIN spaartrack.instrument i ON i.id = oc.instrument_id
         JOIN spaartrack.instrument u ON u.id = oc.underlying_instrument_id
        WHERE oc.instrument_id = $1`,
      [instrumentId]
    );
    if (!result.rowCount) {
      json(res, 404, { error: "OPTION_CONTRACT_NOT_FOUND" });
      return true;
    }
    const contract = optionContractRow(result.rows[0] as Record<string, unknown>);
    const events = await optionLifecycleEvents(instrumentId);
    const parsed = new URL(req.url, "http://localhost");
    const asOf = parsed.searchParams.get("as_of")?.trim() || new Date().toISOString();
    const lifecycle = deriveOptionLifecycleStatus({ expiryAt: contract.expiry_at, asOf, lifecycleEvents: events });
    json(res, 200, {
      ...contract,
      lifecycle_status: lifecycle.status,
      lifecycle_source: lifecycle.source,
      as_of: lifecycle.as_of,
      lifecycle_events: events,
      calculation_version: "option-contract-v1",
      read_only: true
    });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/v1/option-contracts") {
    try {
      const body = await readJson(req);
      const uuid = /^[0-9a-f-]{36}$/i;
      const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
      const instrumentId = typeof body.instrument_id === "string" ? body.instrument_id.trim() : "";
      const underlyingInstrumentId = typeof body.underlying_instrument_id === "string" ? body.underlying_instrument_id.trim() : "";
      if (!uuid.test(portfolioId) || !uuid.test(instrumentId) || !uuid.test(underlyingInstrumentId)) {
        json(res, 400, { error: "INVALID_OPTION_CONTRACT_INPUT" });
        return true;
      }
      if (instrumentId === underlyingInstrumentId) {
        json(res, 400, { error: "INVALID_OPTION_CONTRACT_INPUT" });
        return true;
      }
      const validated = validateOptionContract({
        optionType: body.option_type as string | undefined,
        strikePrice: (body.strike_price ?? NaN) as string | number,
        expiryAt: typeof body.expiry_at === "string" ? body.expiry_at : "",
        contractMultiplier: (body.contract_multiplier ?? 100) as string | number,
        impliedVolatility: body.implied_volatility === null || body.implied_volatility === undefined ? undefined : (body.implied_volatility as string | number),
        asOf: new Date().toISOString()
      });

      const membership = await databasePool.query(
        `SELECT role FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
        [portfolioId, userId]
      );
      const role = membership.rowCount ? String((membership.rows[0] as Record<string, unknown>).role) : "";
      if (!["OWNER", "EDITOR"].includes(role)) {
        json(res, 403, { error: "OPTION_CONTRACT_FORBIDDEN" });
        return true;
      }

      const instrument = await databasePool.query(`SELECT instrument_type FROM spaartrack.instrument WHERE id = $1`, [instrumentId]);
      if (!instrument.rowCount) {
        json(res, 404, { error: "INSTRUMENT_NOT_FOUND" });
        return true;
      }
      if (String((instrument.rows[0] as Record<string, unknown>).instrument_type) !== "OPTION") {
        json(res, 400, { error: "INSTRUMENT_TYPE_NOT_OPTION" });
        return true;
      }
      const underlying = await databasePool.query(`SELECT id FROM spaartrack.instrument WHERE id = $1`, [underlyingInstrumentId]);
      if (!underlying.rowCount) {
        json(res, 404, { error: "UNDERLYING_INSTRUMENT_NOT_FOUND" });
        return true;
      }

      const inserted = await databasePool.query(
        `INSERT INTO spaartrack.option_contract (instrument_id, underlying_instrument_id, option_type, strike_price, expiry_at, contract_multiplier, implied_volatility)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (instrument_id) DO NOTHING
         RETURNING instrument_id`,
        [instrumentId, underlyingInstrumentId, validated.option_type, validated.strike_price, validated.expiry_at, validated.contract_multiplier, validated.implied_volatility]
      );
      if (!inserted.rowCount) {
        json(res, 409, { error: "OPTION_CONTRACT_ALREADY_EXISTS" });
        return true;
      }

      await auditEvent(req, res, userId, "REGISTER", "OPTION_CONTRACT", instrumentId, {
        portfolio_id: portfolioId,
        instrument_id: instrumentId,
        underlying_instrument_id: underlyingInstrumentId,
        option_type: validated.option_type,
        expiry_at: validated.expiry_at,
        implied_volatility: validated.implied_volatility,
        calculation_version: validated.calculation_version
      });
      json(res, 201, { portfolio_id: portfolioId, instrument_id: instrumentId, underlying_instrument_id: underlyingInstrumentId, ...validated });
      return true;
    } catch (error) {
      const message = (error as Error).message;
      if (message === "INVALID_OPTION_CONTRACT") {
        json(res, 400, { error: "INVALID_OPTION_CONTRACT" });
        return true;
      }
      if (message === "invalid_json") {
        json(res, 400, { error: "INVALID_OPTION_CONTRACT_REQUEST" });
        return true;
      }
      console.error(redactedLog({ level: "error", operation: "option_contract_failed", error: message }));
      if (!res.writableEnded) json(res, 400, { error: "OPTION_CONTRACT_REQUEST_FAILED" });
      return true;
    }
  }

  if (req.method === "GET" && req.url === "/api/v1/option-contracts") {
    const result = await databasePool.query(
      `SELECT oc.instrument_id::text AS instrument_id, i.name AS instrument_name, i.currency_code,
              oc.underlying_instrument_id::text AS underlying_instrument_id, u.name AS underlying_instrument_name,
              oc.option_type, oc.strike_price::text, oc.expiry_at, oc.contract_multiplier::text, oc.implied_volatility::text,
              oc.delta::text, oc.gamma::text, oc.theta::text, oc.vega::text, oc.rho::text
         FROM spaartrack.option_contract oc
         JOIN spaartrack.instrument i ON i.id = oc.instrument_id
         JOIN spaartrack.instrument u ON u.id = oc.underlying_instrument_id
        ORDER BY i.name, oc.instrument_id`
    );
    const contracts = (result.rows as Array<Record<string, unknown>>).map(optionContractRow);
    const eventsByInstrument = await optionLifecycleEventsByInstrument(contracts.map((contract) => contract.instrument_id));
    const asOf = new Date().toISOString();
    const enriched = contracts.map((contract) => {
      const lifecycle = deriveOptionLifecycleStatus({
        expiryAt: contract.expiry_at,
        asOf,
        lifecycleEvents: eventsByInstrument.get(contract.instrument_id) ?? []
      });
      return { ...contract, lifecycle_status: lifecycle.status, lifecycle_source: lifecycle.source, as_of: lifecycle.as_of };
    });
    json(res, 200, { contracts: enriched, count: enriched.length, calculation_version: "option-contract-v1", read_only: true });
    return true;
  }

  json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  return true;
}

async function optionGreeksRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/option-greeks")) return false;

  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }
  if (req.method !== "GET") {
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
    return true;
  }

  try {
    const parsed = new URL(req.url, "http://localhost");
    const instrumentId = parsed.searchParams.get("instrument_id")?.trim() || "";
    if (!/^[0-9a-f-]{36}$/i.test(instrumentId)) {
      json(res, 400, { error: "INVALID_OPTION_GREEKS_QUERY" });
      return true;
    }
    const contractResult = await databasePool.query(
      `SELECT oc.instrument_id::text AS instrument_id, oc.option_type, oc.strike_price::text, oc.expiry_at, oc.contract_multiplier::text, oc.implied_volatility::text,
              i.name AS instrument_name, i.currency_code
         FROM spaartrack.option_contract oc
         JOIN spaartrack.instrument i ON i.id = oc.instrument_id
        WHERE oc.instrument_id = $1`,
      [instrumentId]
    );
    if (!contractResult.rowCount) {
      json(res, 404, { error: "OPTION_CONTRACT_NOT_FOUND" });
      return true;
    }
    const row = contractResult.rows[0] as Record<string, unknown>;
    const expiryAt = new Date(row.expiry_at as string).toISOString();
    const asOf = parsed.searchParams.get("as_of")?.trim() || new Date().toISOString();
    const overrideType = parsed.searchParams.get("option_type")?.trim().toUpperCase() || "";
    const volatilityParam = parsed.searchParams.get("volatility")?.trim() || "";
    const storedIv = row.implied_volatility === null || row.implied_volatility === undefined ? null : String(row.implied_volatility).trim();
    const spotParam = parsed.searchParams.get("spot_price")?.trim() || "";
    const rateParam = parsed.searchParams.get("risk_free_rate")?.trim() || "";
    const yieldParam = parsed.searchParams.get("dividend_yield")?.trim() || "";

    const greeks = calculateOptionGreeks({
      optionType: overrideType || String(row.option_type),
      strikePrice: String(row.strike_price),
      spotPrice: spotParam === "" ? NaN : spotParam,
      volatility: volatilityParam !== "" ? volatilityParam : storedIv ?? NaN,
      riskFreeRate: rateParam === "" ? NaN : rateParam,
      dividendYield: yieldParam === "" ? 0 : yieldParam,
      asOf,
      expiryAt,
      contractMultiplier: String(row.contract_multiplier)
    });

    const events = await optionLifecycleEvents(instrumentId);
    const lifecycle = deriveOptionLifecycleStatus({ expiryAt, asOf, lifecycleEvents: events });
    const scenarioOverride = overrideType !== "" && overrideType !== String(row.option_type);
    if (!scenarioOverride) {
      await databasePool.query(
        `UPDATE spaartrack.option_contract
            SET delta = $2, gamma = $3, theta = $4, vega = $5, rho = $6, implied_volatility = COALESCE(implied_volatility, $7)
          WHERE instrument_id = $1`,
        [instrumentId, greeks.delta, greeks.gamma, greeks.theta, greeks.vega, greeks.rho, greeks.implied_volatility]
      );
    }
    await auditEvent(req, res, userId, "CALCULATE", "OPTION_GREEKS", instrumentId, {
      instrument_id: instrumentId,
      option_type: greeks.option_type,
      time_to_expiry_years: greeks.time_to_expiry_years,
      implied_volatility: greeks.implied_volatility,
      scenario_override: scenarioOverride,
      calculation_version: greeks.calculation_version
    });
    json(res, 200, {
      instrument_id: instrumentId,
      instrument_name: String(row.instrument_name),
      currency_code: String(row.currency_code),
      scenario_override: scenarioOverride,
      ...greeks,
      lifecycle_status: lifecycle.status,
      lifecycle_source: lifecycle.source
    });
    return true;
  } catch (error) {
    const message = (error as Error).message;
    if (["INVALID_OPTION_GREEKS_INPUT", "OPTION_EXPIRED", "INVALID_OPTION_CONTRACT"].includes(message)) {
      json(res, 400, { error: message });
      return true;
    }
    console.error(redactedLog({ level: "error", operation: "option_greeks_failed", error: message }));
    if (!res.writableEnded) json(res, 400, { error: "OPTION_GREEKS_REQUEST_FAILED" });
    return true;
  }
}

async function optionOpenLots(portfolioId: string, optionInstrumentId: string) {
  const result = await databasePool.query(
    `SELECT lt.id::text AS transaction_id, lt.effective_date::text AS effective_date,
            le.direction, le.quantity::text, le.amount::text, le.fee_amount::text, le.tax_amount::text
       FROM spaartrack.ledger_transaction lt
       JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
      WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED' AND le.entry_kind = 'POSITION'
        AND le.instrument_id = $2
      ORDER BY lt.effective_date, lt.occurred_at, lt.created_at, lt.id, le.id`,
    [portfolioId, optionInstrumentId]
  );
  const lots: Array<{ transaction_id: string; quantity: number; unit_cost: number; effective_date: string }> = [];
  for (const row of result.rows as Array<Record<string, unknown>>) {
    const quantity = Number(row.quantity);
    if (!(quantity > 0)) continue;
    if (String(row.direction) === "DEBIT") {
      const basis = Number(row.amount) + Number(row.fee_amount || 0) + Number(row.tax_amount || 0);
      lots.push({ transaction_id: String(row.transaction_id), quantity, unit_cost: basis / quantity, effective_date: String(row.effective_date) });
      continue;
    }
    let remaining = quantity;
    while (remaining > 1e-9 && lots.length > 0) {
      const take = Math.min(remaining, lots[0].quantity);
      lots[0].quantity -= take;
      remaining -= take;
      if (lots[0].quantity <= 1e-9) lots.shift();
    }
  }
  return lots;
}

async function optionLifecycleTransactions(transactionIds: string[]) {
  if (transactionIds.length === 0) return [];
  const transactions = await databasePool.query(
    `SELECT id::text, portfolio_id, financial_account_id, activity_type, activity_subtype, state,
            occurred_at, settlement_at, effective_date, source_type, description, external_id,
            external_hash, paired_transaction_id, is_external_flow, metadata, voided_at, created_at, updated_at
       FROM spaartrack.ledger_transaction WHERE id = ANY($1::uuid[])`,
    [transactionIds]
  );
  const entries = await databasePool.query(
    `SELECT id, ledger_transaction_id::text, financial_account_id, instrument_id, entry_kind, direction,
            quantity, unit_price, amount, currency_code, fee_amount, tax_amount, notes
       FROM spaartrack.ledger_entry WHERE ledger_transaction_id = ANY($1::uuid[]) ORDER BY id`,
    [transactionIds]
  );
  const byId = new Map((transactions.rows as Array<Record<string, unknown>>).map((row) => [String(row.id), row]));
  return transactionIds
    .map((transactionId) => byId.get(transactionId))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => transactionResponse(row, (entries.rows as Array<Record<string, unknown>>).filter((entry) => String(entry.ledger_transaction_id) === String(row.id))));
}

function optionLifecycleEventResponse(row: Record<string, unknown>, ledgerTransactions: Array<Record<string, unknown>>) {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    portfolio_id: metadata.portfolio_id ?? null,
    option_instrument_id: String(row.option_instrument_id),
    underlying_instrument_id: metadata.underlying_instrument_id ?? null,
    event_type: String(row.event_type),
    requested_event_type: metadata.requested_event_type ?? row.event_type,
    option_type: metadata.option_type ?? null,
    quantity: fixedAmount(Number(row.quantity)),
    premium_per_contract: metadata.premium_per_contract ?? null,
    gross_premium_amount: metadata.gross_premium_amount ?? null,
    consumed_basis: metadata.consumed_basis ?? null,
    realized_pnl: metadata.realized_pnl ?? null,
    remaining_quantity: metadata.remaining_quantity ?? null,
    remaining_basis: metadata.remaining_basis ?? null,
    destination: metadata.destination ?? null,
    roll_group_id: metadata.roll_group_id ?? null,
    underlying_settlement: metadata.underlying_settlement ?? null,
    occurred_at: new Date(row.occurred_at as string).toISOString(),
    effective_date: metadata.effective_date ?? null,
    currency_code: metadata.currency_code ?? null,
    primary_transaction_id: row.ledger_transaction_id,
    ledger_transactions: ledgerTransactions,
    calculation_version: "option-lifecycle-v1",
    ledger_boundary: "canonical-ledger-application-command",
    read_only: false
  };
}

async function optionLifecycleEventById(eventId: string) {
  const result = await databasePool.query(
    `SELECT ole.id::text, ole.option_instrument_id::text, ole.ledger_transaction_id::text,
            ole.event_type, ole.occurred_at, ole.quantity::text, ole.metadata,
            oc.underlying_instrument_id::text AS contract_underlying_instrument_id
       FROM spaartrack.option_lifecycle_event ole
       JOIN spaartrack.option_contract oc ON oc.instrument_id = ole.option_instrument_id
      WHERE ole.id = $1`,
    [eventId]
  );
  if (!result.rowCount) return null;
  const row = result.rows[0] as Record<string, unknown>;
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const transactionIds = Array.isArray(metadata.ledger_transaction_ids) ? metadata.ledger_transaction_ids.map(String) : [row.ledger_transaction_id].filter(Boolean).map(String);
  return optionLifecycleEventResponse(row, await optionLifecycleTransactions(transactionIds));
}

async function optionLifecycleEventByTransaction(transactionId: string) {
  const result = await databasePool.query(`SELECT id::text FROM spaartrack.option_lifecycle_event WHERE ledger_transaction_id = $1`, [transactionId]);
  if (!result.rowCount) return null;
  return optionLifecycleEventById(String((result.rows[0] as Record<string, unknown>).id));
}

async function optionLifecycleEventRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/option-lifecycle-events")) return false;

  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }

  const parsed = new URL(req.url, "http://localhost");
  if (req.method === "GET" && parsed.pathname === "/api/v1/option-lifecycle-events") {
    const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
    const optionInstrumentId = parsed.searchParams.get("option_instrument_id")?.trim() || null;
    if (!portfolioId) {
      json(res, 400, { error: "INVALID_OPTION_LIFECYCLE_REQUEST" });
      return true;
    }
    const access = await databasePool.query(
      `SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [portfolioId, userId]
    );
    if (!access.rowCount) {
      json(res, 403, { error: "OPTION_LIFECYCLE_FORBIDDEN" });
      return true;
    }
    const result = await databasePool.query(
      `SELECT ole.id::text, ole.option_instrument_id::text, ole.ledger_transaction_id::text,
              ole.event_type, ole.occurred_at, ole.quantity::text, ole.metadata,
              oc.underlying_instrument_id::text AS contract_underlying_instrument_id
         FROM spaartrack.option_lifecycle_event ole
         JOIN spaartrack.option_contract oc ON oc.instrument_id = ole.option_instrument_id
         JOIN spaartrack.ledger_transaction lt ON lt.id = ole.ledger_transaction_id
        WHERE lt.portfolio_id = $1 AND ($2::uuid IS NULL OR ole.option_instrument_id = $2::uuid)
        ORDER BY ole.occurred_at, ole.id`,
      [portfolioId, optionInstrumentId]
    );
    const events = (result.rows as Array<Record<string, unknown>>).map((row) => optionLifecycleEventResponse(row, []));
    json(res, 200, { events, count: events.length, calculation_version: "option-lifecycle-v1", read_only: true });
    return true;
  }

  if (req.method === "POST" && parsed.pathname === "/api/v1/option-lifecycle-events") {
    const uuid = /^[0-9a-f-]{36}$/i;
    try {
      const body = await readJson(req);
      const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
      const accountId = typeof body.financial_account_id === "string" ? body.financial_account_id.trim() : "";
      const optionInstrumentId = typeof body.option_instrument_id === "string" ? body.option_instrument_id.trim() : "";
      if (!uuid.test(portfolioId) || !uuid.test(accountId) || !uuid.test(optionInstrumentId)) {
        json(res, 400, { error: "INVALID_OPTION_LIFECYCLE_REQUEST" });
        return true;
      }
      const contract = await databasePool.query(
        `SELECT option_type, contract_multiplier::text, strike_price::text, underlying_instrument_id::text FROM spaartrack.option_contract WHERE instrument_id = $1`,
        [optionInstrumentId]
      );
      if (!contract.rowCount) {
        json(res, 404, { error: "OPTION_CONTRACT_NOT_FOUND" });
        return true;
      }
      const contractRow = contract.rows[0] as Record<string, unknown>;

      const membership = await databasePool.query(
        `SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL AND role IN ('OWNER', 'EDITOR')`,
        [portfolioId, userId]
      );
      if (!membership.rowCount) {
        json(res, 403, { error: "OPTION_LIFECYCLE_FORBIDDEN" });
        return true;
      }
      const account = await databasePool.query(
        `SELECT 1 FROM spaartrack.financial_account WHERE id = $1 AND portfolio_id = $2`,
        [accountId, portfolioId]
      );
      if (!account.rowCount) {
        json(res, 403, { error: "OPTION_LIFECYCLE_FORBIDDEN" });
        return true;
      }

      const openLots = await optionOpenLots(portfolioId, optionInstrumentId);
      let plan;
      try {
        plan = planOptionLifecycleEvent({
          event_type: body.event_type as string | undefined,
          quantity: body.quantity as string | number | undefined,
          premium: body.premium as string | number | null | undefined,
          strike_price: (body.strike_price ?? contractRow.strike_price) as string | number | null | undefined,
          contract_multiplier: String(contractRow.contract_multiplier),
          option_type: String(contractRow.option_type),
          occurred_at: body.occurred_at as string | undefined,
          effective_date: body.effective_date as string | undefined,
          currency_code: body.currency_code as string | undefined,
          fee_amount: body.fee_amount as string | number | undefined,
          tax_amount: body.tax_amount as string | number | undefined,
          open_lots: openLots,
          destination_option_instrument_id: body.destination_option_instrument_id as string | null | undefined,
          destination_premium: body.destination_premium as string | number | null | undefined,
          roll_group_id: body.roll_group_id as string | null | undefined
        });
      } catch (error) {
        const message = (error as Error).message;
        if (message === "OPTION_QUANTITY_NOT_AVAILABLE") {
          json(res, 409, { error: message });
          return true;
        }
        if (["INVALID_OPTION_LIFECYCLE_INPUT", "ROLL_DESTINATION_REQUIRED"].includes(message)) {
          json(res, 400, { error: message });
          return true;
        }
        throw error;
      }

      let underlyingInstrumentId: string | null = String(contractRow.underlying_instrument_id);
      if (plan.destination) {
        const destination = await databasePool.query(
          `SELECT underlying_instrument_id::text, option_type FROM spaartrack.option_contract WHERE instrument_id = $1`,
          [String(plan.destination.option_instrument_id)]
        );
        if (!destination.rowCount) {
          json(res, 404, { error: "OPTION_CONTRACT_NOT_FOUND" });
          return true;
        }
      }

      const externalId = typeof body.external_id === "string" && body.external_id.trim() ? body.external_id.trim() : null;
      const externalHash = createHash("sha256").update(JSON.stringify({
        kind: "option-lifecycle",
        portfolio_id: portfolioId,
        financial_account_id: accountId,
        option_instrument_id: optionInstrumentId,
        event_type: plan.event_type,
        quantity: plan.quantity,
        premium_per_contract: plan.premium_per_contract,
        destination: plan.destination,
        occurred_at: plan.occurred_at,
        effective_date: plan.effective_date,
        currency_code: plan.currency_code
      })).digest("hex");

      const client = await databasePool.connect();
      let eventId: string;
      let responseBody: Record<string, unknown> | null = null;
      try {
        await client.query("BEGIN");
        if (externalId) {
          const duplicate = await client.query(
            `SELECT id::text, external_id, external_hash FROM spaartrack.ledger_transaction
              WHERE financial_account_id = $1 AND external_id = $2 ORDER BY created_at LIMIT 1 FOR UPDATE`,
            [accountId, externalId]
          );
          if (duplicate.rowCount) {
            const existing = duplicate.rows[0] as Record<string, unknown>;
            if (existing.external_hash !== externalHash) {
              await client.query("ROLLBACK");
              json(res, 409, { error: "IDEMPOTENCY_KEY_CONFLICT" });
              return true;
            }
            const existingEvent = await optionLifecycleEventByTransaction(String(existing.id));
            await client.query("COMMIT");
            if (existingEvent) {
              json(res, 200, { ...existingEvent, idempotent: true });
              return true;
            }
            json(res, 200, { idempotent: true, primary_transaction_id: String(existing.id) });
            return true;
          }
        }

        const transactionIds: string[] = [];
        for (const leg of plan.ledger_plan) {
          const legExternalId = externalId === null
            ? null
            : plan.ledger_plan.length === 1
              ? externalId
              : `${externalId}:${leg.leg}`;
          const legExternalHash = plan.ledger_plan.length === 1
            ? externalHash
            : createHash("sha256").update(`${externalHash}:${leg.leg}`).digest("hex");
          const instrumentId = leg.leg === "UNDERLYING"
            ? underlyingInstrumentId
            : leg.leg === "DESTINATION_OPTION"
              ? String(plan.destination?.option_instrument_id)
              : optionInstrumentId;
          const transaction = await client.query(
            `INSERT INTO spaartrack.ledger_transaction
               (portfolio_id, financial_account_id, activity_type, state, occurred_at, effective_date,
                description, external_id, external_hash, source_type, is_external_flow, metadata, created_by)
             VALUES ($1, $2, $3, 'POSTED', $4, $5, $6, $7, $8, 'SYSTEM', false, $9, $10)
             RETURNING id::text`,
            [
              portfolioId, accountId, leg.activity_type, plan.occurred_at, plan.effective_date,
              `Option ${plan.event_type} ${optionInstrumentId}`,
              legExternalId, legExternalHash,
              JSON.stringify({ ...leg.metadata, option_lifecycle: true, calculation_version: plan.calculation_version, leg: leg.leg }),
              userId
            ]
          );
          const transactionId = String((transaction.rows[0] as Record<string, unknown>).id);
          transactionIds.push(transactionId);
          await client.query(
            `INSERT INTO spaartrack.ledger_entry
               (ledger_transaction_id, financial_account_id, instrument_id, entry_kind, direction,
                quantity, unit_price, amount, currency_code, fee_amount, tax_amount)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              transactionId, accountId, leg.leg === "DESTINATION_OPTION" ? String(plan.destination?.option_instrument_id) : instrumentId,
              leg.entry_kind, leg.direction, leg.quantity, leg.unit_price, leg.amount,
              leg.currency_code, leg.fee_amount, leg.tax_amount
            ]
          );
        }

        const metadata = {
          requested_event_type: plan.requested_event_type,
          option_type: plan.option_type,
          premium_per_contract: plan.premium_per_contract,
          gross_premium_amount: plan.gross_premium_amount,
          consumed_basis: plan.consumed_basis,
          realized_pnl: plan.realized_pnl,
          remaining_quantity: plan.remaining_quantity,
          remaining_basis: plan.remaining_basis,
          destination: plan.destination,
          roll_group_id: plan.roll_group_id,
          underlying_settlement: plan.underlying_settlement,
          effective_date: plan.effective_date,
          currency_code: plan.currency_code,
          portfolio_id: portfolioId,
          underlying_instrument_id: underlyingInstrumentId,
          external_id: externalId,
          external_hash: externalHash,
          calculation_version: plan.calculation_version,
          ledger_transaction_ids: transactionIds
        };
        const inserted = await client.query(
          `INSERT INTO spaartrack.option_lifecycle_event (option_instrument_id, ledger_transaction_id, event_type, occurred_at, quantity, metadata)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id::text`,
          [optionInstrumentId, transactionIds[0], plan.event_type, plan.occurred_at, plan.quantity, JSON.stringify(metadata)]
        );
        eventId = String((inserted.rows[0] as Record<string, unknown>).id);
        await client.query("COMMIT");
        const stored = await optionLifecycleEventById(eventId);
        responseBody = stored;
        await auditEvent(req, res, userId, plan.event_type, "OPTION_LIFECYCLE_EVENT", eventId, {
          portfolio_id: portfolioId,
          option_instrument_id: optionInstrumentId,
          underlying_instrument_id: underlyingInstrumentId,
          realized_pnl: plan.realized_pnl,
          roll_group_id: plan.roll_group_id,
          ledger_transaction_ids: transactionIds,
          calculation_version: plan.calculation_version
        });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
      json(res, 201, responseBody);
      return true;
    } catch (error) {
      const message = (error as Error).message;
      if (message === "invalid_json" || message === "request_too_large") {
        json(res, 400, { error: "INVALID_OPTION_LIFECYCLE_REQUEST" });
        return true;
      }
      console.error(redactedLog({ level: "error", operation: "option_lifecycle_failed", error: message }));
      if (!res.writableEnded) json(res, 400, { error: "OPTION_LIFECYCLE_REQUEST_FAILED" });
      return true;
    }
  }

  json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  return true;
}

async function optionPositionRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/option-positions")) return false;

  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }

  const parsed = new URL(req.url, "http://localhost");
  if (req.method !== "GET") {
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
    return true;
  }
  const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
  if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) {
    json(res, 400, { error: "INVALID_OPTION_POSITION_REQUEST" });
    return true;
  }
  const access = await databasePool.query(
    `SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [portfolioId, userId]
  );
  if (!access.rowCount) {
    json(res, 403, { error: "OPTION_POSITION_FORBIDDEN" });
    return true;
  }
  const instruments = await databasePool.query(
    `SELECT DISTINCT le.instrument_id::text AS instrument_id, oc.underlying_instrument_id::text AS underlying_instrument_id
       FROM spaartrack.ledger_transaction lt
       JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
       JOIN spaartrack.instrument i ON i.id = le.instrument_id AND i.instrument_type = 'OPTION'
       LEFT JOIN spaartrack.option_contract oc ON oc.instrument_id = le.instrument_id
      WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED' AND le.entry_kind = 'POSITION' AND le.instrument_id IS NOT NULL`,
    [portfolioId]
  );
  const positions = [];
  for (const row of instruments.rows as Array<Record<string, unknown>>) {
    const lots = await optionOpenLots(portfolioId, String(row.instrument_id));
    const summary = summarizeOptionPosition({ open_lots: lots });
    if (Number(summary.remaining_quantity) <= 0) continue;
    positions.push({
      option_instrument_id: String(row.instrument_id),
      underlying_instrument_id: row.underlying_instrument_id ? String(row.underlying_instrument_id) : null,
      ...summary
    });
  }
  json(res, 200, { positions, count: positions.length, calculation_version: "option-position-v1", read_only: true });
  return true;
}

async function wheelCycleRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/wheel-cycles")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "POST" || new URL(req.url, "http://localhost").pathname !== "/api/v1/wheel-cycles") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const body = await readJson(req);
    const cycle = planWheelCycle({ events: Array.isArray(body.events) ? body.events : [] });
    await auditEvent(req, res, userId, "CALCULATE", "WHEEL_CYCLE", randomUUID(), { calculation_version: cycle.calculation_version, linked: cycle.linked, stages: cycle.stages.length });
    json(res, 201, { ...cycle, trace_id: traceId(req), correlation_id: correlationId(req) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WHEEL_CYCLE_FAILED";
    if (message === "INVALID_WHEEL_EVENT") { json(res, 400, { error: message }); return true; }
    console.error(redactedLog({ level: "error", operation: "wheel_cycle_failed", error: message }));
    if (!res.writableEnded) json(res, 400, { error: "WHEEL_CYCLE_FAILED" });
  }
  return true;
}

async function alternativeAssetValuationRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/alternative-asset-valuations")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "POST" || new URL(req.url, "http://localhost").pathname !== "/api/v1/alternative-asset-valuations") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const body = await readJson(req);
    const valuation = describeAlternativeAssetValuation({
      instrument_type: body.instrument_type as string | undefined, asset_class: body.asset_class as string | undefined, currency_code: body.currency_code as string | undefined,
      valuation_source: body.valuation_source as string | undefined, manual_price: (body.manual_price as number | string | null | undefined) ?? null, provider_price: (body.provider_price as number | string | null | undefined) ?? null
    });
    await auditEvent(req, res, userId, "CALCULATE", "ALTERNATIVE_ASSET_VALUATION", randomUUID(), { calculation_version: valuation.calculation_version, instrument_type: valuation.instrument_type, valuation_source: valuation.valuation_source });
    json(res, 201, { ...valuation, trace_id: traceId(req), correlation_id: correlationId(req) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ALTERNATIVE_ASSET_FAILED";
    if (message === "INVALID_ALTERNATIVE_ASSET") { json(res, 400, { error: message }); return true; }
    console.error(redactedLog({ level: "error", operation: "alternative_asset_failed", error: message }));
    if (!res.writableEnded) json(res, 400, { error: "ALTERNATIVE_ASSET_FAILED" });
  }
  return true;
}

async function fireScenarioRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/fire-scenarios")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "POST" || new URL(req.url, "http://localhost").pathname !== "/api/v1/fire-scenarios") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const body = await readJson(req);
    const scenario = planFireScenario({
      horizon_years: body.horizon_years as number | string | undefined,
      annual_contribution: body.annual_contribution as number | string | undefined,
      expected_return: body.expected_return as number | string | undefined,
      inflation_rate: body.inflation_rate as number | string | undefined,
      tax_rate: body.tax_rate as number | string | undefined,
      initial_capital: body.initial_capital as number | string | undefined,
      monte_carlo: (body.monte_carlo && typeof body.monte_carlo === "object" ? body.monte_carlo : {}) as { iterations?: number | string; seed?: number | string | null; volatility?: number | string; distribution?: string }
    });
    const persisted = await databasePool.query(
      `INSERT INTO spaartrack.retirement_scenario (user_id, assumptions, tax_assumptions, inflation_assumptions, result, status)
       VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, 'SUCCEEDED') RETURNING id`,
      [userId, JSON.stringify({ ...scenario.assumptions, calculation_version: scenario.calculation_version }), JSON.stringify({ tax_rate: scenario.assumptions.tax_rate }), JSON.stringify({ inflation_rate: scenario.assumptions.inflation_rate }), JSON.stringify({ ...scenario.result, sensitivity: scenario.sensitivity, sequence_of_returns: scenario.sequence_of_returns })]
    );
    const scenarioId = String(persisted.rows[0].id);
    await databasePool.query(
      `INSERT INTO spaartrack.monte_carlo_run (retirement_scenario_id, iterations, seed, result) VALUES ($1, $2, $3, $4::jsonb)`,
      [scenarioId, scenario.monte_carlo.iterations, scenario.monte_carlo.seed === null ? null : Number(scenario.monte_carlo.seed), JSON.stringify(scenario.monte_carlo.result)]
    );
    await auditEvent(req, res, userId, "CALCULATE", "FIRE_SCENARIO", scenarioId, { calculation_version: scenario.calculation_version, iterations: scenario.monte_carlo.iterations });
    json(res, 201, { scenario_id: scenarioId, ...scenario, trace_id: traceId(req), correlation_id: correlationId(req) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "FIRE_SCENARIO_FAILED";
    if (message === "INVALID_FIRE_SCENARIO") { json(res, 400, { error: message }); return true; }
    console.error(redactedLog({ level: "error", operation: "fire_scenario_failed", error: message }));
    if (!res.writableEnded) json(res, 400, { error: "FIRE_SCENARIO_FAILED" });
  }
  return true;
}

async function benchmarkRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/benchmarks") && !req.url?.startsWith("/api/v1/benchmark-observations")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    if (parsed.pathname === "/api/v1/benchmarks" && req.method === "GET") {
      const result = await databasePool.query(`SELECT id, name, symbol, currency_code, is_active FROM spaartrack.benchmark WHERE is_active = true ORDER BY name, id`);
      json(res, 200, { benchmarks: result.rows, calculation_version: "benchmark-catalog-v1" });
      return true;
    }
    if (parsed.pathname === "/api/v1/benchmarks" && req.method === "POST") {
      const body = await readJson(req);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const symbol = typeof body.symbol === "string" && body.symbol.trim() ? body.symbol.trim() : null;
      const currencyCode = typeof body.currency_code === "string" ? body.currency_code.trim().toUpperCase() : "";
      if (!name || !/^[A-Z]{3}$/.test(currencyCode)) { json(res, 400, { error: "INVALID_BENCHMARK_INPUT" }); return true; }
      const result = await databasePool.query(`INSERT INTO spaartrack.benchmark (name, symbol, currency_code) VALUES ($1, $2, $3) RETURNING id, name, symbol, currency_code, is_active`, [name, symbol, currencyCode]);
      json(res, 201, result.rows[0]);
      return true;
    }
    if (parsed.pathname === "/api/v1/benchmark-observations" && req.method === "POST") {
      const body = await readJson(req);
      const benchmarkId = typeof body.benchmark_id === "string" ? body.benchmark_id.trim() : "";
      const observedAt = typeof body.observed_at === "string" ? body.observed_at.trim() : "";
      const indexValue = typeof body.index_value === "number" ? String(body.index_value) : typeof body.index_value === "string" ? body.index_value.trim() : "";
      const currencyCode = typeof body.currency_code === "string" ? body.currency_code.trim().toUpperCase() : "";
      if (!/^[0-9a-f-]{36}$/i.test(benchmarkId) || !/^\d{4}-\d{2}-\d{2}$/.test(observedAt) || !/^\d+(\.\d+)?$/.test(indexValue) || Number(indexValue) <= 0 || !/^[A-Z]{3}$/.test(currencyCode)) { json(res, 400, { error: "INVALID_BENCHMARK_OBSERVATION_INPUT" }); return true; }
      const result = await databasePool.query(`INSERT INTO spaartrack.benchmark_observation (benchmark_id, observed_at, index_value, currency_code) VALUES ($1, $2, $3, $4) RETURNING benchmark_id, observed_at, index_value::text, currency_code`, [benchmarkId, observedAt, indexValue, currencyCode]);
      json(res, 201, result.rows[0]);
      return true;
    }
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "benchmark_route_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "BENCHMARK_REQUEST_FAILED" });
  }
  return true;
}

async function benchmarkComparisonRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/performance-benchmark")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
    const benchmarkId = parsed.searchParams.get("benchmark_id")?.trim() || "";
    const periodStart = parsed.searchParams.get("period_start")?.trim() || "";
    const periodEnd = parsed.searchParams.get("period_end")?.trim() || "";
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^[0-9a-f-]{36}$/i.test(benchmarkId) || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) { json(res, 400, { error: "INVALID_BENCHMARK_QUERY" }); return true; }
    const access = await databasePool.query(`SELECT p.reporting_currency_code FROM spaartrack.portfolio p JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = p.id WHERE p.id = $1 AND pm.user_id = $2 AND pm.revoked_at IS NULL`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
    const benchmark = await databasePool.query(`SELECT id, name, symbol, currency_code FROM spaartrack.benchmark WHERE id = $1 AND is_active = true`, [benchmarkId]);
    if (!benchmark.rowCount) { json(res, 404, { error: "BENCHMARK_NOT_FOUND" }); return true; }
    const observations = await databasePool.query(`SELECT observed_at::text, index_value::text, currency_code FROM spaartrack.benchmark_observation WHERE benchmark_id = $1 AND observed_at BETWEEN $2::date AND $3::date ORDER BY observed_at`, [benchmarkId, periodStart, periodEnd]);
    const first = observations.rows[0];
    const last = observations.rows[observations.rows.length - 1];
    if (!first || !last || String(first.observed_at).slice(0, 10) !== periodStart || String(last.observed_at).slice(0, 10) !== periodEnd) { json(res, 409, { error: "BENCHMARK_OBSERVATIONS_REQUIRED", required: { period_start: periodStart, period_end: periodEnd } }); return true; }
    const flowRows = await databasePool.query(`SELECT lt.effective_date::text, lt.activity_type, le.amount::text FROM spaartrack.ledger_transaction lt JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED' AND lt.is_external_flow = true AND lt.effective_date > $2::date AND lt.effective_date <= $3::date AND lt.activity_type IN ('DEPOSIT', 'WITHDRAWAL') ORDER BY lt.effective_date, lt.id`, [portfolioId, periodStart, periodEnd]);
    const cashflows = flowRows.rows.map((row) => ({ date: String(row.effective_date).slice(0, 10), activity_type: row.activity_type, amount: fixedAmount((row.activity_type === "WITHDRAWAL" ? -1 : 1) * Number(row.amount || 0)) }));
    const startIndex = Number(first.index_value);
    const endIndex = Number(last.index_value);
    const observationReturn = (endIndex / startIndex - 1) * 100;
    let units = 0;
    for (const flow of cashflows) {
      const observation = [...observations.rows].reverse().find((row) => String(row.observed_at).slice(0, 10) <= flow.date);
      if (observation) units += Number(flow.amount) / Number(observation.index_value);
    }
    const matchedEndValue = units * endIndex;
    const netCashFlow = cashflows.reduce((sum, flow) => sum + Number(flow.amount), 0);
    const matchedReturn = netCashFlow !== 0 ? (matchedEndValue - netCashFlow) / netCashFlow * 100 : null;
    const method = (name: string, returnPct: number | null, formulaVersion: string, limitations: string) => ({ method: name, return_pct: returnPct === null ? null : fixedAmount(returnPct), formula_version: formulaVersion, limitations, period_start: periodStart, period_end: periodEnd, currency_code: benchmark.rows[0].currency_code, cashflows });
    json(res, 200, { portfolio_id: portfolioId, benchmark: benchmark.rows[0], period_start: periodStart, period_end: periodEnd, currency_code: benchmark.rows[0].currency_code, observation_return_pct: fixedAmount(observationReturn), cashflow_matched_return_pct: matchedReturn === null ? null : fixedAmount(matchedReturn), cashflow_matched: { benchmark_end_value: fixedAmount(matchedEndValue), net_cash_flow: fixedAmount(netCashFlow), cashflows }, variants: { observation: method("BENCHMARK_OBSERVATION", observationReturn, "benchmark-observation-v1", "Pure benchmark index observation; portfolio cashflows are not applied."), cashflow_matched: method("CASHFLOW_MATCHED", matchedReturn, "benchmark-cashflow-matched-v1", "Replays portfolio external cashflow dates and amounts against benchmark observations.") }, calculation_version: "benchmark-comparison-v1" });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "benchmark_comparison_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "BENCHMARK_COMPARISON_FAILED" });
  }
  return true;
}

const alertChannels = ["IN_APP", "EMAIL", "PUSH"] as const;
const TRADING_212_PROVIDER_KEY = "TRADING_212";
const providerSyncSchemaDriftEvidence = "schema drift";
const providerSyncFailureScenarios: Record<string, { errorCode: string; providerStatusCode: number; retryable: boolean; maxAttempts: number; retryAfterSeconds: number; severity: string; message: string }> = {
  AUTH_401: { errorCode: "PROVIDER_UNAUTHORIZED", providerStatusCode: 401, retryable: false, maxAttempts: 1, retryAfterSeconds: 0, severity: "SEV-2", message: "Provider rejected the configured authorization." },
  AUTH_403: { errorCode: "PROVIDER_FORBIDDEN", providerStatusCode: 403, retryable: false, maxAttempts: 1, retryAfterSeconds: 0, severity: "SEV-2", message: "Provider denied the requested read scope." },
  PROVIDER_429: { errorCode: "PROVIDER_RATE_LIMITED", providerStatusCode: 429, retryable: true, maxAttempts: 3, retryAfterSeconds: 30, severity: "SEV-3", message: "Provider rate limit requires a bounded retry." },
  SCHEMA_FAILURE: { errorCode: "PROVIDER_SCHEMA_FAILURE", providerStatusCode: 422, retryable: false, maxAttempts: 1, retryAfterSeconds: 0, severity: "SEV-2", message: "Provider payload schema requires adapter review." }
};

async function syncIncidentsRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/sync-incidents")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    if (req.method !== "GET" || parsed.pathname !== "/api/v1/sync-incidents") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
    const connectionId = parsed.searchParams.get("connection_id") || "";
    if (!/^[0-9a-f-]{36}$/i.test(connectionId)) { json(res, 400, { error: "CONNECTION_ID_REQUIRED" }); return true; }
    const result = await databasePool.query(`SELECT i.id, i.fingerprint, i.severity, i.status, i.title, i.service, i.environment, i.first_seen_at, i.last_seen_at, i.root_cause, i.impact_summary, i.evidence, (SELECT sr.error_code FROM spaartrack.sync_run sr WHERE sr.id = (i.evidence->>'sync_run_id')::uuid) AS error_code FROM spaartrack.incident i JOIN spaartrack.external_connection ec ON ec.id = $1::uuid AND ec.user_id = $2 WHERE i.evidence->>'connection_id' = $1::text ORDER BY i.first_seen_at ASC`, [connectionId, userId]);
    const incidents = [];
    for (const incident of result.rows) {
      const events = await databasePool.query(`SELECT id, event_type, actor_type, actor_id, payload, created_at FROM spaartrack.incident_event WHERE incident_id = $1 ORDER BY created_at ASC`, [incident.id]);
      incidents.push({ ...incident, events: events.rows });
    }
    json(res, 200, { connection_id: connectionId, incidents, calculation_version: "sync-incident-v1", read_only: true });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "sync_incidents_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "SYNC_INCIDENTS_FAILED" });
  }
  return true;
}

async function incidentRoutingRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/incidents")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const evidenceMatch = parsed.pathname.match(/^\/api\/v1\/incidents\/([0-9a-f-]{36})\/evidence$/i);
    // incidentVerifierReviewRoute is the incident-verifier-v1 branch of incidentRoutingRoute.
    const verifierMatch = parsed.pathname.match(/^\/api\/v1\/incidents\/([0-9a-f-]{36})\/verifier-review$/i);
    if (req.method === "POST" && verifierMatch) {
      const body = await readJson(req);
      const traced = res as TracedResponse;
      let review;
      try {
        review = buildVerifierReview({
          ...(body as unknown as Record<string, unknown>),
          incident_id: verifierMatch[1],
          correlation_id: traced.correlation_id || String((body as Record<string, unknown>).correlation_id || ""),
          trace_id: traced.trace_id || String((body as Record<string, unknown>).trace_id || "")
        } as never);
      } catch (error) {
        json(res, 400, { error: String((error as Error).message || "INVALID_VERIFIER_REVIEW") });
        return true;
      }
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        const incident = await client.query(`SELECT i.id FROM spaartrack.incident i WHERE i.id = $1::uuid AND EXISTS (SELECT 1 FROM spaartrack.incident_event ie WHERE ie.incident_id = i.id AND ie.actor_id = $2) FOR UPDATE`, [review.incident_id, userId]);
        if (!incident.rowCount) { await client.query("ROLLBACK"); json(res, 404, { error: "INCIDENT_NOT_FOUND" }); return true; }
        await client.query(`UPDATE spaartrack.incident SET evidence = evidence || $1::jsonb, last_seen_at = now() WHERE id = $2::uuid`, [JSON.stringify({ verifier_review: review }), review.incident_id]);
        await client.query(`INSERT INTO spaartrack.incident_event (incident_id, event_type, actor_type, actor_id, payload) VALUES ($1, 'VERIFICATION', 'AGENT', $2, $3)`, [review.incident_id, userId, JSON.stringify({ calculation_version: review.calculation_version, reproducibility_key: review.reproducibility_key, coverage_verdict: review.coverage_verdict, security_verdict: review.security_verdict, promotion_allowed: review.promotion_allowed, correlation_id: review.correlation_id, trace_id: review.trace_id })]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
      finally { client.release(); }
      await auditEvent(req, res, userId, "CALCULATE", "VERIFIER_REVIEW", review.incident_id, { calculation_version: review.calculation_version, reproducibility_key: review.reproducibility_key, coverage_verdict: review.coverage_verdict, security_verdict: review.security_verdict, promotion_allowed: review.promotion_allowed, ledger_untouched: true });
      json(res, 201, { ...review, ledger_untouched: true });
      return true;
    }
    // incidentSkillProposalRoute is the incident-skill-proposal-v1 branch of incidentRoutingRoute.
    const skillMatch = parsed.pathname.match(/^\/api\/v1\/incidents\/([0-9a-f-]{36})\/skill-proposal$/i);
    if (req.method === "POST" && skillMatch) {
      const body = await readJson(req);
      const traced = res as TracedResponse;
      let proposal;
      try {
        proposal = buildSkillProposal({
          ...(body as unknown as Record<string, unknown>),
          incident_id: skillMatch[1],
          correlation_id: traced.correlation_id || String((body as Record<string, unknown>).correlation_id || ""),
          trace_id: traced.trace_id || String((body as Record<string, unknown>).trace_id || "")
        } as never);
      } catch (error) {
        json(res, 400, { error: String((error as Error).message || "INVALID_SKILL_PROPOSAL") });
        return true;
      }
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        const incident = await client.query(`SELECT i.id FROM spaartrack.incident i WHERE i.id = $1::uuid AND EXISTS (SELECT 1 FROM spaartrack.incident_event ie WHERE ie.incident_id = i.id AND ie.actor_id = $2) FOR UPDATE`, [proposal.incident_id, userId]);
        if (!incident.rowCount) { await client.query("ROLLBACK"); json(res, 404, { error: "INCIDENT_NOT_FOUND" }); return true; }
        await client.query(`UPDATE spaartrack.incident SET evidence = evidence || $1::jsonb, last_seen_at = now() WHERE id = $2::uuid`, [JSON.stringify({ skill_proposal: proposal }), proposal.incident_id]);
        await client.query(`INSERT INTO spaartrack.incident_event (incident_id, event_type, actor_type, actor_id, payload) VALUES ($1, 'VERIFICATION', 'AGENT', $2, $3)`, [proposal.incident_id, userId, JSON.stringify({ calculation_version: proposal.calculation_version, reproducibility_key: proposal.reproducibility_key, proposal_verdict: proposal.proposal_verdict, proposal_allowed: proposal.proposal_allowed, blockers: proposal.blockers, correlation_id: proposal.correlation_id, trace_id: proposal.trace_id })]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
      finally { client.release(); }
      await auditEvent(req, res, userId, "CALCULATE", "SKILL_PROPOSAL", proposal.incident_id, { calculation_version: proposal.calculation_version, reproducibility_key: proposal.reproducibility_key, proposal_verdict: proposal.proposal_verdict, proposal_allowed: proposal.proposal_allowed, blockers: proposal.blockers, ledger_untouched: true });
      json(res, 201, { ...proposal, ledger_untouched: true });
      return true;
    }
    // incidentClosureRoute is the incident-closure-v1 branch of incidentRoutingRoute.
    const closureMatch = parsed.pathname.match(/^\/api\/v1\/incidents\/([0-9a-f-]{36})\/closure$/i);
    if (req.method === "POST" && closureMatch) {
      const body = await readJson(req);
      const traced = res as TracedResponse;
      let closure;
      try {
        closure = buildIncidentClosure({
          ...(body as unknown as Record<string, unknown>),
          incident_id: closureMatch[1],
          correlation_id: traced.correlation_id || String((body as Record<string, unknown>).correlation_id || ""),
          trace_id: traced.trace_id || String((body as Record<string, unknown>).trace_id || "")
        } as never);
      } catch (error) {
        json(res, 400, { error: String((error as Error).message || "INVALID_INCIDENT_CLOSURE") });
        return true;
      }
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        const incident = await client.query(`SELECT i.id FROM spaartrack.incident i WHERE i.id = $1::uuid AND EXISTS (SELECT 1 FROM spaartrack.incident_event ie WHERE ie.incident_id = i.id AND ie.actor_id = $2) FOR UPDATE`, [closure.incident_id, userId]);
        if (!incident.rowCount) { await client.query("ROLLBACK"); json(res, 404, { error: "INCIDENT_NOT_FOUND" }); return true; }
        await client.query(`UPDATE spaartrack.incident SET evidence = evidence || $1::jsonb, last_seen_at = now() WHERE id = $2::uuid`, [JSON.stringify({ incident_closure: closure }), closure.incident_id]);
        await client.query(`INSERT INTO spaartrack.incident_event (incident_id, event_type, actor_type, actor_id, payload) VALUES ($1, 'VERIFICATION', 'AGENT', $2, $3)`, [closure.incident_id, userId, JSON.stringify({ calculation_version: closure.calculation_version, reproducibility_key: closure.reproducibility_key, closure_verdict: closure.closure_verdict, closure_allowed: closure.closure_allowed, correlation_id: closure.correlation_id, trace_id: closure.trace_id })]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
      finally { client.release(); }
      await auditEvent(req, res, userId, "CALCULATE", "INCIDENT_CLOSURE", closure.incident_id, { calculation_version: closure.calculation_version, reproducibility_key: closure.reproducibility_key, closure_verdict: closure.closure_verdict, closure_allowed: closure.closure_allowed, missing_fields: closure.missing_fields, ledger_untouched: true });
      json(res, 201, { ...closure, ledger_untouched: true });
      return true;
    }
    // incidentRollbackGateRoute is the incident-rollback-v1 branch of incidentRoutingRoute.
    const rollbackMatch = parsed.pathname.match(/^\/api\/v1\/incidents\/([0-9a-f-]{36})\/rollback-gate$/i);
    if (req.method === "POST" && rollbackMatch) {
      const body = await readJson(req);
      const traced = res as TracedResponse;
      let gate;
      try {
        gate = buildRollbackGate({
          ...(body as unknown as Record<string, unknown>),
          incident_id: rollbackMatch[1],
          correlation_id: traced.correlation_id || String((body as Record<string, unknown>).correlation_id || ""),
          trace_id: traced.trace_id || String((body as Record<string, unknown>).trace_id || "")
        } as never);
      } catch (error) {
        json(res, 400, { error: String((error as Error).message || "INVALID_ROLLBACK_GATE") });
        return true;
      }
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        const incident = await client.query(`SELECT i.id FROM spaartrack.incident i WHERE i.id = $1::uuid AND EXISTS (SELECT 1 FROM spaartrack.incident_event ie WHERE ie.incident_id = i.id AND ie.actor_id = $2) FOR UPDATE`, [gate.incident_id, userId]);
        if (!incident.rowCount) { await client.query("ROLLBACK"); json(res, 404, { error: "INCIDENT_NOT_FOUND" }); return true; }
        await client.query(`UPDATE spaartrack.incident SET evidence = evidence || $1::jsonb, last_seen_at = now() WHERE id = $2::uuid`, [JSON.stringify({ rollback_gate: gate }), gate.incident_id]);
        await client.query(`INSERT INTO spaartrack.incident_event (incident_id, event_type, actor_type, actor_id, payload) VALUES ($1, 'VERIFICATION', 'AGENT', $2, $3)`, [gate.incident_id, userId, JSON.stringify({ calculation_version: gate.calculation_version, reproducibility_key: gate.reproducibility_key, policy_verdict: gate.policy_verdict, rollback_allowed: gate.rollback_allowed, data_restore_separate: gate.data_restore_separate, correlation_id: gate.correlation_id, trace_id: gate.trace_id })]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
      finally { client.release(); }
      await auditEvent(req, res, userId, "CALCULATE", "ROLLBACK_GATE", gate.incident_id, { calculation_version: gate.calculation_version, reproducibility_key: gate.reproducibility_key, policy_verdict: gate.policy_verdict, rollback_allowed: gate.rollback_allowed, ledger_untouched: true });
      json(res, 201, { ...gate, ledger_untouched: true });
      return true;
    }
    // incidentPromotionGateRoute is the incident-promotion-v1 branch of incidentRoutingRoute.
    const promotionMatch = parsed.pathname.match(/^\/api\/v1\/incidents\/([0-9a-f-]{36})\/promotion-gate$/i);
    if (req.method === "POST" && promotionMatch) {
      const body = await readJson(req);
      const traced = res as TracedResponse;
      let gate;
      try {
        gate = buildPromotionGate({
          ...(body as unknown as Record<string, unknown>),
          incident_id: promotionMatch[1],
          correlation_id: traced.correlation_id || String((body as Record<string, unknown>).correlation_id || ""),
          trace_id: traced.trace_id || String((body as Record<string, unknown>).trace_id || "")
        } as never);
      } catch (error) {
        json(res, 400, { error: String((error as Error).message || "INVALID_PROMOTION_GATE") });
        return true;
      }
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        const incident = await client.query(`SELECT i.id FROM spaartrack.incident i WHERE i.id = $1::uuid AND EXISTS (SELECT 1 FROM spaartrack.incident_event ie WHERE ie.incident_id = i.id AND ie.actor_id = $2) FOR UPDATE`, [gate.incident_id, userId]);
        if (!incident.rowCount) { await client.query("ROLLBACK"); json(res, 404, { error: "INCIDENT_NOT_FOUND" }); return true; }
        await client.query(`UPDATE spaartrack.incident SET evidence = evidence || $1::jsonb, last_seen_at = now() WHERE id = $2::uuid`, [JSON.stringify({ promotion_gate: gate }), gate.incident_id]);
        await client.query(`INSERT INTO spaartrack.incident_event (incident_id, event_type, actor_type, actor_id, payload) VALUES ($1, 'VERIFICATION', 'AGENT', $2, $3)`, [gate.incident_id, userId, JSON.stringify({ calculation_version: gate.calculation_version, reproducibility_key: gate.reproducibility_key, identity_verdict: gate.identity_verdict, health_verdict: gate.health_verdict, promotion_allowed: gate.promotion_allowed, correlation_id: gate.correlation_id, trace_id: gate.trace_id })]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
      finally { client.release(); }
      await auditEvent(req, res, userId, "CALCULATE", "PROMOTION_GATE", gate.incident_id, { calculation_version: gate.calculation_version, reproducibility_key: gate.reproducibility_key, identity_verdict: gate.identity_verdict, health_verdict: gate.health_verdict, promotion_allowed: gate.promotion_allowed, ledger_untouched: true });
      json(res, 201, { ...gate, ledger_untouched: true });
      return true;
    }
    // incidentFixVerificationRoute is the incident-fix-verification-v1 branch of incidentRoutingRoute.
    const fixMatch = parsed.pathname.match(/^\/api\/v1\/incidents\/([0-9a-f-]{36})\/fix-verification$/i);
    if (req.method === "POST" && fixMatch) {
      const body = await readJson(req);
      const traced = res as TracedResponse;
      let verification;
      try {
        verification = buildFixVerification({
          ...(body as unknown as Record<string, unknown>),
          incident_id: fixMatch[1],
          correlation_id: traced.correlation_id || String((body as Record<string, unknown>).correlation_id || ""),
          trace_id: traced.trace_id || String((body as Record<string, unknown>).trace_id || "")
        } as never);
      } catch (error) {
        json(res, 400, { error: String((error as Error).message || "INVALID_FIX_VERIFICATION") });
        return true;
      }
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        const incident = await client.query(`SELECT i.id FROM spaartrack.incident i WHERE i.id = $1::uuid AND EXISTS (SELECT 1 FROM spaartrack.incident_event ie WHERE ie.incident_id = i.id AND ie.actor_id = $2) FOR UPDATE`, [verification.incident_id, userId]);
        if (!incident.rowCount) { await client.query("ROLLBACK"); json(res, 404, { error: "INCIDENT_NOT_FOUND" }); return true; }
        await client.query(`UPDATE spaartrack.incident SET evidence = evidence || $1::jsonb, last_seen_at = now() WHERE id = $2::uuid`, [JSON.stringify({ fix_verification: verification }), verification.incident_id]);
        await client.query(`INSERT INTO spaartrack.incident_event (incident_id, event_type, actor_type, actor_id, payload) VALUES ($1, 'VERIFICATION', 'AGENT', $2, $3)`, [verification.incident_id, userId, JSON.stringify({ calculation_version: verification.calculation_version, reproducibility_key: verification.reproducibility_key, old_result: verification.old_result, new_result: verification.new_result, correlation_id: verification.correlation_id, trace_id: verification.trace_id })]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
      finally { client.release(); }
      await auditEvent(req, res, userId, "CALCULATE", "FIX_VERIFICATION", verification.incident_id, { calculation_version: verification.calculation_version, reproducibility_key: verification.reproducibility_key, old_result: verification.old_result, new_result: verification.new_result, ledger_untouched: true });
      json(res, 201, { ...verification, ledger_untouched: true });
      return true;
    }
    // incidentDiagnosisRoute is the incident-diagnosis-v1 branch of incidentRoutingRoute.
    const hypothesisMatch = parsed.pathname.match(/^\/api\/v1\/incidents\/([0-9a-f-]{36})\/hypotheses$/i);
    if (req.method === "POST" && hypothesisMatch) {
      const body = await readJson(req);
      const traced = res as TracedResponse;
      const hypothesis = buildIncidentHypothesis({
        ...(body as unknown as Omit<IncidentHypothesisInput, "incident_id" | "correlation_id" | "trace_id">),
        incident_id: hypothesisMatch[1],
        correlation_id: traced.correlation_id || String(body.correlation_id || ""),
        trace_id: traced.trace_id || String(body.trace_id || "")
      });
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        const incident = await client.query(`SELECT i.id FROM spaartrack.incident i WHERE i.id = $1::uuid AND EXISTS (SELECT 1 FROM spaartrack.incident_event ie WHERE ie.incident_id = i.id AND ie.actor_id = $2) FOR UPDATE`, [hypothesis.incident_id, userId]);
        if (!incident.rowCount) { await client.query("ROLLBACK"); json(res, 404, { error: "INCIDENT_NOT_FOUND" }); return true; }
        await client.query(`UPDATE spaartrack.incident SET evidence = evidence || $1::jsonb, last_seen_at = now() WHERE id = $2::uuid`, [JSON.stringify({ diagnosis_hypothesis: hypothesis }), hypothesis.incident_id]);
        await client.query(`INSERT INTO spaartrack.incident_event (incident_id, event_type, actor_type, actor_id, payload) VALUES ($1, 'VERIFICATION', 'AGENT', $2, $3)`, [hypothesis.incident_id, userId, JSON.stringify({ calculation_version: hypothesis.calculation_version, reproducibility_key: hypothesis.reproducibility_key, correlation_id: hypothesis.correlation_id, trace_id: hypothesis.trace_id })]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
      finally { client.release(); }
      await auditEvent(req, res, userId, "CALCULATE", "INCIDENT_HYPOTHESIS", hypothesis.incident_id, { calculation_version: hypothesis.calculation_version, reproducibility_key: hypothesis.reproducibility_key, ledger_untouched: true });
      json(res, 201, { ...hypothesis, ledger_untouched: true });
      return true;
    }
    if (req.method === "POST" && evidenceMatch) {
      const body = await readJson(req);
      const traced = res as TracedResponse;
      const evidence = buildIncidentEvidenceBundle({
        ...(body as unknown as Omit<IncidentEvidenceInput, "incident_id" | "correlation_id" | "trace_id">),
        incident_id: evidenceMatch[1],
        correlation_id: traced.correlation_id || String(body.correlation_id || ""),
        trace_id: traced.trace_id || String(body.trace_id || "")
      });
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        const incident = await client.query(
          `SELECT i.id
             FROM spaartrack.incident i
            WHERE i.id = $1::uuid
              AND EXISTS (
                SELECT 1 FROM spaartrack.incident_event ie
                 WHERE ie.incident_id = i.id AND ie.actor_id = $2
              )
            FOR UPDATE`,
          [evidence.incident_id, userId]
        );
        if (!incident.rowCount) {
          await client.query("ROLLBACK");
          json(res, 404, { error: "INCIDENT_NOT_FOUND" });
          return true;
        }
        await client.query(
          `UPDATE spaartrack.incident
              SET evidence = evidence || $1::jsonb,
                  last_seen_at = now()
            WHERE id = $2::uuid`,
          [JSON.stringify({ evidence_bundle: evidence }), evidence.incident_id]
        );
        await client.query(
          `INSERT INTO spaartrack.incident_event
            (incident_id, event_type, actor_type, actor_id, payload)
           VALUES ($1, 'VERIFICATION', 'AGENT', $2, $3)`,
          [evidence.incident_id, userId, JSON.stringify({ calculation_version: evidence.calculation_version, correlation_id: evidence.correlation_id, trace_id: evidence.trace_id, pii_redacted: true })]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
      await auditEvent(req, res, userId, "CREATE", "INCIDENT_EVIDENCE", evidence.incident_id, { calculation_version: evidence.calculation_version, pii_redacted: true, redacted_exemplars: true, ledger_untouched: true });
      json(res, 201, evidence);
      return true;
    }
    if (req.method === "GET" && parsed.pathname === "/api/v1/incidents") {
      const result = await databasePool.query(`SELECT id, fingerprint, severity, status, title, service, environment, first_seen_at, last_seen_at, affected_release_id, evidence FROM spaartrack.incident WHERE status NOT IN ('RESOLVED', 'CLOSED') ORDER BY last_seen_at DESC, id DESC LIMIT 100`);
      const incidents = [];
      for (const incident of result.rows) {
        const events = await databasePool.query(`SELECT id, event_type, actor_type, actor_id, payload, created_at FROM spaartrack.incident_event WHERE incident_id = $1 ORDER BY created_at ASC`, [incident.id]);
        incidents.push({ ...incident, events: events.rows });
      }
      json(res, 200, { incidents, calculation_version: "incident-router-v1", read_only: true });
      return true;
    }
    if (req.method !== "POST" || parsed.pathname !== "/api/v1/incidents/alerts") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
    const body = await readJson(req);
    const traced = res as TracedResponse;
    const alert = buildIncidentAlert({
      title: String(body.title || ""), service: String(body.service || ""), environment: String(body.environment || environment),
      release: String(body.release || release), severity: String(body.severity || "") as never, message: String(body.message || ""),
      occurred_at: typeof body.occurred_at === "string" ? body.occurred_at : undefined,
      correlation_id: traced.correlation_id || String(body.correlation_id || ""), trace_id: traced.trace_id || String(body.trace_id || "")
    });
    const client = await databasePool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(`SELECT id, severity, status FROM spaartrack.incident WHERE fingerprint = $1 AND status NOT IN ('RESOLVED', 'CLOSED') ORDER BY last_seen_at DESC LIMIT 1 FOR UPDATE`, [alert.fingerprint]);
      const nextSeverity = existing.rowCount && severityRank(String(existing.rows[0].severity)) > severityRank(alert.severity) ? String(existing.rows[0].severity) : alert.severity;
      const incident = existing.rowCount
        ? await client.query(`UPDATE spaartrack.incident SET severity = $1, last_seen_at = now(), evidence = evidence || $2::jsonb, impact_summary = $3 WHERE id = $4 RETURNING id, fingerprint, severity, status`, [nextSeverity, JSON.stringify({ ...alert, grouping_window_minutes: alert.grouping_window_minutes }), alert.message, existing.rows[0].id])
        : await client.query(`INSERT INTO spaartrack.incident (fingerprint, severity, status, title, service, environment, first_seen_at, last_seen_at, impact_summary, evidence) VALUES ($1, $2, 'OPEN', $3, $4, $5, now(), now(), $6, $7) RETURNING id, fingerprint, severity, status`, [alert.fingerprint, alert.severity, alert.title, alert.service, alert.environment, alert.message, JSON.stringify({ ...alert, release: alert.release })]);
      const incidentId = String(incident.rows[0].id);
      await client.query(`INSERT INTO spaartrack.incident_event (incident_id, event_type, actor_type, actor_id, payload) VALUES ($1, 'ALERT', 'SYSTEM', $2, $3)`, [incidentId, userId, JSON.stringify({ ...alert, incident_id: incidentId })]);
      await client.query("COMMIT");
      const grouped = Boolean(existing.rowCount);
      await auditEvent(req, res, userId, "CREATE", "INCIDENT_ALERT", incidentId, { fingerprint: alert.fingerprint, grouped, severity: incident.rows[0].severity, service: alert.service, environment: alert.environment });
      json(res, grouped ? 200 : 201, { incident_id: incidentId, fingerprint: alert.fingerprint, severity: incident.rows[0].severity, status: incident.rows[0].status, grouped, grouping_window_minutes: alert.grouping_window_minutes, calculation_version: "incident-router-v1", read_only: true });
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "INCIDENT_ROUTING_FAILED";
    if (message.startsWith("INVALID_INCIDENT_")) { json(res, 400, { error: message }); return true; }
    console.error(redactedLog({ level: "error", operation: "incident_routing_failed", error: message }));
    if (!res.writableEnded) json(res, 400, { error: "INCIDENT_ROUTING_FAILED" });
  }
  return true;
}

// incidentEvidenceRoute is the incident-evidence-v1 branch of incidentRoutingRoute;
// it links redacted_exemplars, image_digest and migration_result without ledger writes.

async function syncResultsRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/sync-results")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const itemMatch = parsed.pathname.match(/^\/api\/v1\/sync-results\/([0-9a-f-]{36})$/i);
    if (req.method === "PATCH" && itemMatch) {
      const body = await readJson(req);
      const decision = typeof body.review_decision === "string" ? body.review_decision.trim().toUpperCase() : "";
      if (!["ACCEPT", "REJECT", "IGNORE"].includes(decision)) { json(res, 400, { error: "INVALID_SYNC_REVIEW_DECISION" }); return true; }
      const result = await databasePool.query(`UPDATE spaartrack.sync_result_item item SET review_decision = $1, posting_status = 'POSTING_REVIEW' WHERE item.id = $2 AND EXISTS (SELECT 1 FROM spaartrack.external_connection ec WHERE ec.id = item.connection_id AND ec.user_id = $3) RETURNING item.id, item.external_id, item.item_type, item.posting_status, item.review_decision`, [decision, itemMatch[1], userId]);
      if (!result.rowCount) { json(res, 404, { error: "SYNC_RESULT_NOT_FOUND" }); return true; }
      await auditEvent(req, res, userId, "CORRECTION", "SYNC_RESULT_ITEM", itemMatch[1], { review_decision: decision });
      json(res, 200, { ...result.rows[0], read_only: true, posting_boundary: "application-review-only" });
      return true;
    }
    if (req.method !== "GET" || parsed.pathname !== "/api/v1/sync-results") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
    const connectionId = parsed.searchParams.get("connection_id") || "";
    const syncRunId = parsed.searchParams.get("sync_run_id") || "";
    if (!/^[0-9a-f-]{36}$/i.test(connectionId)) { json(res, 400, { error: "CONNECTION_ID_REQUIRED" }); return true; }
    const values: unknown[] = [connectionId, userId];
    const runClause = syncRunId ? " AND sri.sync_run_id = $3" : "";
    if (syncRunId) values.push(syncRunId);
    const result = await databasePool.query(`SELECT sri.id, sri.sync_run_id, sri.external_id, sri.item_type, sri.posting_status, sri.review_decision, sri.payload_json, sri.created_at FROM spaartrack.sync_result_item sri JOIN spaartrack.external_connection ec ON ec.id = sri.connection_id WHERE sri.connection_id = $1 AND ec.user_id = $2${runClause} ORDER BY sri.created_at ASC, sri.external_id ASC`, values);
    const items = result.rows;
    const counts = { new: items.filter((item) => item.item_type === "NEW").length, updated: items.filter((item) => item.item_type === "UPDATED").length, duplicate: items.filter((item) => item.item_type === "DUPLICATE").length, rejected: items.filter((item) => item.item_type === "REJECTED").length, attention: items.filter((item) => item.item_type === "ATTENTION").length };
    json(res, 200, { connection_id: connectionId, sync_run_id: syncRunId || items[0]?.sync_run_id || null, items, counts, posting_status: items.some((item) => item.posting_status === "POSTED") ? "POSTED" : items.some((item) => item.posting_status === "POSTING_REVIEW") ? "POSTING_REVIEW" : "NOT_POSTED", read_only: true, calculation_version: "sync-review-v1" });
    return true;
  } catch (error) { console.error(redactedLog({ level: "error", operation: "sync_results_failed", error: (error as Error).message })); if (!res.writableEnded) json(res, 400, { error: "SYNC_RESULTS_FAILED" }); }
  return true;
}

async function connectionRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/connections")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const match = parsed.pathname.match(/^\/api\/v1\/connections\/([0-9a-f-]{36})(\/revoke)?$/i);
    const syncMatch = parsed.pathname.match(/^\/api\/v1\/connections\/([0-9a-f-]{36})\/sync$/i);
    const selectConnections = `SELECT ec.id, ec.provider_id, p.slug AS provider_slug, p.name AS provider_name, ec.auth_mode, ec.status, ec.display_name, ec.credential_ref_id, csr.vault_path, ec.provider_metadata, ec.created_at, ec.updated_at, COALESCE(json_agg(json_build_object('id', pa.id, 'external_account_id', pa.external_account_id, 'account_type', CASE pa.account_type WHEN 'INVESTMENT' THEN 'INVEST' WHEN 'ISA' THEN 'STOCKS_ISA' ELSE pa.account_type END, 'name', pa.name, 'base_currency_code', pa.base_currency_code, 'is_active', pa.is_active) ORDER BY pa.external_account_id) FILTER (WHERE pa.id IS NOT NULL), '[]') AS accounts FROM spaartrack.external_connection ec JOIN spaartrack.provider p ON p.id = ec.provider_id LEFT JOIN spaartrack.credential_secret_ref csr ON csr.id = ec.credential_ref_id LEFT JOIN spaartrack.provider_account pa ON pa.connection_id = ec.id`;
    if (req.method === "GET" && parsed.pathname === "/api/v1/connections") {
      const result = await databasePool.query(`${selectConnections} WHERE ec.user_id = $1 GROUP BY ec.id, p.slug, p.name, csr.vault_path ORDER BY ec.created_at DESC`, [userId]);
      json(res, 200, { connections: result.rows.map((row) => ({ ...row, read_only: row.provider_metadata?.read_only === true })), calculation_version: "connection-registry-v1" });
      return true;
    }
    if (syncMatch && req.method === "POST") {
      const body = await readJson(req);
      const connectionId = syncMatch[1];
      const connection = await databasePool.query(`SELECT ec.id, ec.provider_id, ec.status, p.slug AS provider_slug FROM spaartrack.external_connection ec JOIN spaartrack.provider p ON p.id = ec.provider_id WHERE ec.id = $1 AND ec.user_id = $2`, [connectionId, userId]);
      if (!connection.rowCount) { json(res, 404, { error: "CONNECTION_NOT_FOUND" }); return true; }
      if (connection.rows[0].status === "REVOKED") { json(res, 409, { error: "CONNECTION_REVOKED" }); return true; }
      const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload as Record<string, unknown> : {};
      const accounts = Array.isArray(payload.accounts) ? payload.accounts.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];
      const positions = Array.isArray(payload.positions) ? payload.positions.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];
      const activities = Array.isArray(payload.activities) ? payload.activities.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];
      const dividends = Array.isArray(payload.dividends) ? payload.dividends.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];
      const records = [...accounts, ...positions, ...activities, ...dividends];
      const fixtureName = typeof body.fixture === "string" ? body.fixture : "PROVIDER-001";
      const scenario = typeof body.scenario === "string" ? body.scenario.toUpperCase() : "SUCCESS";
      const schemaVersion = typeof payload.schema_version === "string" ? payload.schema_version : "trading212-v1";
      if (fixtureName !== "PROVIDER-001" || !records.length || !payload.cursor) { json(res, 400, { error: "INVALID_PROVIDER_FIXTURE" }); return true; }
      const previous = await databasePool.query(`SELECT payload_json FROM spaartrack.raw_provider_payload WHERE connection_id = $1 AND payload_json IS NOT NULL`, [connectionId]);
      const previousIds = new Set<string>();
      for (const row of previous.rows) {
        const prior = row.payload_json as Record<string, unknown>;
        for (const key of ["accounts", "positions", "activities", "dividends"]) for (const item of (Array.isArray(prior[key]) ? prior[key] : [])) if (item && typeof item === "object") { const identity = (item as Record<string, unknown>).external_id ?? (item as Record<string, unknown>).external_account_id; if (typeof identity === "string") previousIds.add(identity); }
      }
      const recordsDuplicate = records.filter((item) => { const identity = item.external_id ?? item.external_account_id; return typeof identity === "string" && previousIds.has(identity); }).length;
      const recordsRejected = scenario === "REJECTED" ? records.length : 0;
      const recordsCreated = records.length - recordsDuplicate - recordsRejected;
      const attentionItems = scenario === "SCHEMA_DRIFT" || schemaVersion !== "trading212-v1" ? 1 : 0;
      const attempts = scenario === "RATE_LIMITED" ? 2 : 1;
      const status = attentionItems || recordsRejected ? "PARTIAL" : "SUCCEEDED";
      const failure = providerSyncFailureScenarios[scenario];
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        if (failure) {
          const traceId = (res as TracedResponse).trace_id || req.headers["x-trace-id"]?.toString() || randomUUID();
          const correlationId = (res as TracedResponse).correlation_id || req.headers["x-correlation-id"]?.toString() || randomUUID();
          const retryPolicy = { retryable: failure.retryable, max_attempts: failure.maxAttempts, retry_after_seconds: failure.retryAfterSeconds, strategy: failure.retryable ? "EXPONENTIAL_BACKOFF" : "NO_RETRY" };
          const evidence = { connection_id: connectionId, provider_slug: connection.rows[0].provider_slug, sync_run_id: null, error_code: failure.errorCode, provider_status_code: failure.providerStatusCode, retry_policy: retryPolicy, trace_id: traceId, correlation_id: correlationId };
          const run = await client.query(`INSERT INTO spaartrack.sync_run (connection_id, status, trigger_type, cursor_before, cursor_after, window_from, window_to, started_at, finished_at, records_seen, error_code, error_message, diagnostics) SELECT $1, 'FAILED', 'MANUAL', sc.provider_cursor, $2, now(), now(), now(), now(), $3, $4, $5, $6 FROM (SELECT provider_cursor FROM spaartrack.sync_checkpoint WHERE connection_id = $1 UNION ALL SELECT NULL WHERE NOT EXISTS (SELECT 1 FROM spaartrack.sync_checkpoint WHERE connection_id = $1) LIMIT 1) sc RETURNING id`, [connectionId, String(payload.cursor), records.length, failure.errorCode, failure.message, JSON.stringify({ provider_status_code: failure.providerStatusCode, retry_policy: retryPolicy, trace_id: traceId, correlation_id: correlationId })]);
          evidence.sync_run_id = run.rows[0].id;
          const incident = await client.query(`INSERT INTO spaartrack.incident (fingerprint, severity, status, title, service, environment, first_seen_at, last_seen_at, impact_summary, evidence) VALUES ($1, $2, 'OPEN', $3, 'provider-sync', 'local', now(), now(), $4, $5) ON CONFLICT (fingerprint, status) DO UPDATE SET last_seen_at = now(), evidence = EXCLUDED.evidence, impact_summary = EXCLUDED.impact_summary RETURNING id`, [`provider-sync:${connectionId}:${failure.errorCode}`, failure.severity, `${failure.errorCode} during provider sync`, failure.message, JSON.stringify(evidence)]);
          await client.query(`INSERT INTO spaartrack.incident_event (incident_id, event_type, actor_type, actor_id, payload) VALUES ($1, 'ALERT', 'SYSTEM', $2, $3)`, [incident.rows[0].id, userId, JSON.stringify({ ...evidence, message: failure.message })]);
          await client.query(`UPDATE spaartrack.external_connection SET status = 'ERROR', last_error_code = $1, last_error_message = $2, last_sync_started_at = now(), last_sync_completed_at = now(), updated_at = now() WHERE id = $3`, [failure.errorCode, failure.message, connectionId]);
          await client.query("COMMIT");
          json(res, 200, { status: "FAILED", error_code: failure.errorCode, provider_status_code: failure.providerStatusCode, retry_policy: retryPolicy, sync_run_id: run.rows[0].id, incident_id: incident.rows[0].id, trace_id: traceId, correlation_id: correlationId, connection_id: connectionId, read_only: true, calculation_version: "provider-sync-failure-v1" });
          return true;
        }
        const run = await client.query(`INSERT INTO spaartrack.sync_run (connection_id, status, trigger_type, cursor_before, cursor_after, window_from, window_to, started_at, finished_at, records_seen, records_created, records_updated, records_duplicate, records_rejected, diagnostics) SELECT $1, $2, 'MANUAL', sc.provider_cursor, $3, now() - interval '2 days', now(), now(), now(), $4, $5, 0, $6, $7, $8 FROM (SELECT provider_cursor FROM spaartrack.sync_checkpoint WHERE connection_id = $1 UNION ALL SELECT NULL WHERE NOT EXISTS (SELECT 1 FROM spaartrack.sync_checkpoint WHERE connection_id = $1) LIMIT 1) sc RETURNING id`, [connectionId, status, String(payload.cursor), records.length, recordsCreated, recordsDuplicate, recordsRejected, JSON.stringify({ fixture: fixtureName, schema_version: schemaVersion, rate_limit: { attempts, retry_after_seconds: attempts > 1 ? 1 : 0 }, positions: positions.length, activities: activities.length, dividends: dividends.length, records_rejected: recordsRejected })]);
        const payloadJson = JSON.stringify({ fixture: fixtureName, schema_version: schemaVersion, cursor: payload.cursor, accounts, positions, activities, dividends });
        const payloadRow = await client.query(`INSERT INTO spaartrack.raw_provider_payload (connection_id, sync_run_id, payload_type, provider_endpoint, content_type, payload_json, checksum_sha256, schema_version) VALUES ($1, $2, 'API_RESPONSE', $3, 'application/json', $4, $5, $6) RETURNING id`, [connectionId, run.rows[0].id, `${connection.rows[0].provider_slug}/sync`, payloadJson, createHash("sha256").update(payloadJson).digest("hex"), schemaVersion]);
        for (const record of records) {
          const externalId = String(record.external_id ?? record.external_account_id ?? randomUUID());
          const itemType = scenario === "REJECTED" ? "REJECTED" : recordsDuplicate > 0 && previousIds.has(externalId) ? "DUPLICATE" : "NEW";
          await client.query(`INSERT INTO spaartrack.sync_result_item (sync_run_id, connection_id, external_id, item_type, payload_json) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (sync_run_id, external_id) DO NOTHING`, [run.rows[0].id, connectionId, externalId, itemType, JSON.stringify(record)]);
        }
        if (attentionItems) await client.query(`INSERT INTO spaartrack.sync_result_item (sync_run_id, connection_id, external_id, item_type, payload_json) VALUES ($1, $2, $3, 'ATTENTION', $4)`, [run.rows[0].id, connectionId, `schema-drift:${run.rows[0].id}`, JSON.stringify({ schema_version: schemaVersion, reason: providerSyncSchemaDriftEvidence })]);
        for (const account of accounts) await client.query(`UPDATE spaartrack.provider_account SET provider_metadata = provider_metadata || $1::jsonb, updated_at = now() WHERE connection_id = $2 AND external_account_id = $3`, [JSON.stringify({ last_balance: account.balance ?? null, last_balance_currency: account.currency_code ?? null, provider_updated_at: account.provider_updated_at ?? null, sync_payload_id: payloadRow.rows[0].id }), connectionId, String(account.external_account_id)]);
        await client.query(`INSERT INTO spaartrack.sync_checkpoint (connection_id, provider_cursor, last_activity_at, last_balance_at, last_position_at) VALUES ($1, $2, now(), now(), now()) ON CONFLICT (connection_id) DO UPDATE SET provider_cursor = EXCLUDED.provider_cursor, last_activity_at = EXCLUDED.last_activity_at, last_balance_at = EXCLUDED.last_balance_at, last_position_at = EXCLUDED.last_position_at, updated_at = now()`, [connectionId, String(payload.cursor)]);
        await client.query(`UPDATE spaartrack.sync_run SET diagnostics = diagnostics || $1::jsonb WHERE id = $2`, [JSON.stringify({ raw_payload_id: payloadRow.rows[0].id }), run.rows[0].id]);
        await client.query(`UPDATE spaartrack.external_connection SET status = $1, last_sync_started_at = now(), last_sync_completed_at = now(), last_successful_sync_at = CASE WHEN $1 = 'HEALTHY' THEN now() ELSE last_successful_sync_at END, last_error_code = CASE WHEN $1 = 'DEGRADED' THEN 'SCHEMA_DRIFT' ELSE NULL END, last_error_message = CASE WHEN $1 = 'DEGRADED' THEN $3 ELSE NULL END, updated_at = now() WHERE id = $2`, [attentionItems ? "DEGRADED" : "HEALTHY", connectionId, `${providerSyncSchemaDriftEvidence}: Provider fixture schema requires review`]);
        await client.query("COMMIT");
        json(res, 200, { sync_run_id: run.rows[0].id, connection_id: connectionId, provider_slug: connection.rows[0].provider_slug, status, cursor_before: run.rows[0].cursor_before, cursor_after: payload.cursor, records_seen: records.length, records_created: recordsCreated, records_updated: 0, records_duplicate: recordsDuplicate, records_rejected: recordsRejected, attention_items: attentionItems, accounts: accounts.length, positions: positions.length, activities: activities.length, dividends: dividends.length, rate_limit: { attempts, retry_after_seconds: attempts > 1 ? 1 : 0 }, read_only: true, summary_type: "sync-summary", calculation_version: "provider-sync-v1", raw_payload_id: payloadRow.rows[0].id });
      } catch (error) {
        await client.query("ROLLBACK");
        console.error(redactedLog({ level: "error", operation: "provider_sync_failed", connection_id: connectionId, error: (error as Error).message }));
        json(res, 400, { error: "PROVIDER_SYNC_FAILED" });
      } finally { client.release(); }
      return true;
    }
    if (match?.[2] && req.method === "POST") {
      const result = await databasePool.query(`UPDATE spaartrack.external_connection ec SET status = 'REVOKED', disconnected_at = now(), updated_at = now() WHERE ec.id = $1 AND ec.user_id = $2 RETURNING ec.id`, [match[1], userId]);
      if (!result.rowCount) { json(res, 404, { error: "CONNECTION_NOT_FOUND" }); return true; }
      await databasePool.query(`UPDATE spaartrack.credential_secret_ref csr SET revoked_at = now() WHERE csr.id = (SELECT credential_ref_id FROM spaartrack.external_connection WHERE id = $1)`, [match[1]]);
      await databasePool.query(`UPDATE spaartrack.connection_scope SET revoked_at = now() WHERE connection_id = $1 AND revoked_at IS NULL`, [match[1]]);
      const detail = await databasePool.query(`${selectConnections} WHERE ec.id = $1 AND ec.user_id = $2 GROUP BY ec.id, p.slug, p.name, csr.vault_path`, [match[1], userId]);
      json(res, 200, { ...detail.rows[0], read_only: true, calculation_version: "connection-revoked-v1" });
      return true;
    }
    if (req.method === "POST" && parsed.pathname === "/api/v1/connections") {
      const body = await readJson(req);
      const providerSlug = typeof body.provider_slug === "string" ? body.provider_slug.trim().toLowerCase() : "";
      const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
      const authMode = typeof body.auth_mode === "string" ? body.auth_mode.trim().toUpperCase() : "";
      const vaultPath = typeof body.vault_path === "string" ? body.vault_path.trim() : "";
      const scopes = Array.isArray(body.scopes) ? body.scopes.filter((scope) => typeof scope === "string" && scope.trim()).map((scope) => String(scope).trim()) : [];
      const accounts = Array.isArray(body.accounts) ? body.accounts.filter((account) => account && typeof account === "object") as Array<Record<string, unknown>> : [];
      const validAccountTypes = ["INVEST", "STOCKS_ISA"];
      if (!providerSlug || !displayName || authMode !== "API_KEY" || !vaultPath || !scopes.length || !accounts.length || accounts.some((account) => typeof account.external_account_id !== "string" || !validAccountTypes.includes(String(account.account_type)) || typeof account.name !== "string" || typeof account.base_currency_code !== "string")) { json(res, 400, { error: "INVALID_CONNECTION_INPUT" }); return true; }
      const provider = await databasePool.query(`SELECT id, slug, name FROM spaartrack.provider WHERE slug = $1 AND status <> 'RETIRED'`, [providerSlug]);
      if (!provider.rowCount) { json(res, 404, { error: "PROVIDER_NOT_FOUND" }); return true; }
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        const secret = await client.query(`INSERT INTO spaartrack.credential_secret_ref (user_id, vault_path, secret_kind) VALUES ($1, $2, 'API_KEY') RETURNING id`, [userId, vaultPath]);
        const connection = await client.query(`INSERT INTO spaartrack.external_connection (user_id, provider_id, auth_mode, status, display_name, credential_ref_id, provider_metadata) VALUES ($1, $2, 'API_KEY', 'AUTHORIZED', $3, $4, $5) RETURNING id, provider_id, auth_mode, status, display_name, credential_ref_id, provider_metadata, created_at, updated_at`, [userId, provider.rows[0].id, displayName, secret.rows[0].id, JSON.stringify({ read_only: true, provider_slug: providerSlug })]);
        for (const scope of scopes) await client.query(`INSERT INTO spaartrack.connection_scope (connection_id, scope) VALUES ($1, $2)`, [connection.rows[0].id, scope]);
        for (const account of accounts) {
          const accountType = account.account_type === "INVEST" ? "INVESTMENT" : "ISA";
          await client.query(`INSERT INTO spaartrack.provider_account (connection_id, external_account_id, account_type, name, base_currency_code, provider_metadata) VALUES ($1, $2, $3, $4, $5, $6)`, [connection.rows[0].id, account.external_account_id, accountType, account.name, String(account.base_currency_code).toUpperCase(), JSON.stringify({ source: "synthetic-trading212", mapping: account.account_type })]);
        }
        await client.query("COMMIT");
        json(res, 201, { id: connection.rows[0].id, provider_id: connection.rows[0].provider_id, provider_slug: providerSlug, provider_name: provider.rows[0].name, auth_mode: "API_KEY", status: "AUTHORIZED", display_name: displayName, credential_ref_id: connection.rows[0].credential_ref_id, vault_path: vaultPath, read_only: true, scopes, accounts, calculation_version: "connection-authorized-v1" });
      } catch (error) {
        await client.query("ROLLBACK");
        if ((error as { code?: string }).code === "23505") json(res, 409, { error: "CONNECTION_ALREADY_EXISTS" }); else json(res, 400, { error: "CONNECTION_REQUEST_FAILED" });
      } finally { client.release(); }
      return true;
    }
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "connection_route_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "CONNECTION_REQUEST_FAILED" });
  }
  return true;
}

async function providerRegistryRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/providers")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const providerTypes = ["BROKER", "BANK", "AGGREGATOR", "MARKET_DATA", "IMPORT"];
  const providerStatuses = ["ACTIVE", "DEGRADED", "PAUSED", "RETIRED"];
  try {
    const parsed = new URL(req.url, "http://localhost");
    const providerSlug = parsed.pathname.match(/^\/api\/v1\/providers\/([a-z0-9][a-z0-9._-]{1,63})$/i)?.[1] || "";
    if (req.method === "GET") {
      const result = await databasePool.query(`SELECT p.id, p.slug, p.name, p.provider_type, p.api_version, p.region, p.status, p.capabilities, p.documentation_url, p.created_at, p.updated_at, COALESCE(json_agg(json_build_object('capability', pc.capability, 'supported', pc.supported, 'details', pc.details) ORDER BY pc.capability) FILTER (WHERE pc.capability IS NOT NULL), '[]') AS capability_rows FROM spaartrack.provider p LEFT JOIN spaartrack.provider_capability pc ON pc.provider_id = p.id ${providerSlug ? "WHERE p.slug = $1" : ""} GROUP BY p.id ORDER BY p.name, p.slug`, providerSlug ? [providerSlug] : []);
      const providers = result.rows.map((row) => ({ ...row, auth_mode: row.capabilities?.auth_mode || null, capabilities: row.capability_rows }));
      if (providerSlug && !providers.length) { json(res, 404, { error: "PROVIDER_NOT_FOUND" }); return true; }
      json(res, 200, { providers, calculation_version: "provider-registry-v1" });
      return true;
    }
    if (req.method === "POST" && !providerSlug) {
      const body = await readJson(req);
      const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const providerType = typeof body.provider_type === "string" ? body.provider_type.trim().toUpperCase() : "";
      const authMode = typeof body.auth_mode === "string" ? body.auth_mode.trim().toUpperCase() : "";
      const apiVersion = typeof body.api_version === "string" ? body.api_version.trim() : null;
      const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "ACTIVE";
      const capabilities = Array.isArray(body.capabilities) ? body.capabilities.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];
      if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(slug) || !name || !providerTypes.includes(providerType) || !authMode || !providerStatuses.includes(status) || capabilities.some((item) => typeof item.capability !== "string" || typeof item.supported !== "boolean")) { json(res, 400, { error: "INVALID_PROVIDER_INPUT" }); return true; }
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query(`INSERT INTO spaartrack.provider (slug, name, provider_type, api_version, status, capabilities) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (slug) DO NOTHING RETURNING id, slug, name, provider_type, api_version, region, status, capabilities, documentation_url, created_at, updated_at`, [slug, name, providerType, apiVersion, status, JSON.stringify({ auth_mode: authMode })]);
        if (!result.rowCount) { await client.query("ROLLBACK"); json(res, 409, { error: "PROVIDER_ALREADY_EXISTS" }); return true; }
        for (const capability of capabilities) await client.query(`INSERT INTO spaartrack.provider_capability (provider_id, capability, supported, details) VALUES ($1, $2, $3, $4)`, [result.rows[0].id, capability.capability, capability.supported, JSON.stringify(capability.details || {})]);
        await client.query("COMMIT");
        json(res, 201, { ...result.rows[0], auth_mode: authMode, capabilities });
      } catch (error) {
        await client.query("ROLLBACK");
        if ((error as { code?: string }).code === "23505") json(res, 409, { error: "PROVIDER_ALREADY_EXISTS" }); else json(res, 400, { error: "INVALID_PROVIDER_REQUEST" });
      } finally { client.release(); }
      return true;
    }
    if (req.method === "PATCH" && providerSlug) {
      const body = await readJson(req);
      const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : null;
      const apiVersion = typeof body.api_version === "string" ? body.api_version.trim() : null;
      if ((status !== null && !providerStatuses.includes(status)) || (status === null && apiVersion === null)) { json(res, 400, { error: "INVALID_PROVIDER_UPDATE" }); return true; }
      const result = await databasePool.query(`UPDATE spaartrack.provider SET status = COALESCE($2, status), api_version = COALESCE($3, api_version), updated_at = now() WHERE slug = $1 RETURNING id, slug, name, provider_type, api_version, region, status, capabilities, documentation_url, created_at, updated_at`, [providerSlug, status, apiVersion]);
      if (!result.rowCount) { json(res, 404, { error: "PROVIDER_NOT_FOUND" }); return true; }
      json(res, 200, { ...result.rows[0], auth_mode: result.rows[0].capabilities?.auth_mode || null, capabilities: [] });
      return true;
    }
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "provider_registry_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "PROVIDER_REGISTRY_REQUEST_FAILED" });
  }
  return true;
}

async function bankInstitutionRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/bank-institutions")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  const parsed = new URL(req.url, "http://localhost");
  const provider = (parsed.searchParams.get("provider") || "gocardless").trim().toLowerCase();
  const region = (parsed.searchParams.get("region") || "").trim().toUpperCase();
  const capability = (parsed.searchParams.get("capability") || "").trim().toUpperCase();
  if (provider !== "gocardless" || (region && !/^[A-Z]{2}$/.test(region)) || (capability && !/^[A-Z_]{2,40}$/.test(capability))) {
    json(res, 400, { error: "INVALID_BANK_INSTITUTION_QUERY" });
    return true;
  }
  const institutions = syntheticBankInstitutions.filter((institution) => (!region || institution.region === region) && (!capability || (institution.capabilities as readonly string[]).includes(capability)));
  json(res, 200, { provider, fixture: "BANK-001", institutions, filters: { region: region || null, capability: capability || null }, calculation_version: "bank-institution-catalog-v1", read_only: true });
  return true;
}

async function bankRequisitionRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/bank-requisitions")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const parsed = new URL(req.url, "http://localhost");
  const callbackPath = parsed.pathname === "/api/v1/bank-requisitions/callback";
  try {
    if (req.method === "POST" && parsed.pathname === "/api/v1/bank-requisitions") {
      const body = await readJson(req);
      const institutionId = typeof body.institution_id === "string" ? body.institution_id.trim() : "";
      const redirectUri = typeof body.redirect_uri === "string" ? body.redirect_uri.trim() : "";
      const language = typeof body.language === "string" ? body.language.trim().toLowerCase() : "";
      const codeChallenge = typeof body.code_challenge === "string" ? body.code_challenge.trim() : "";
      const fixture = typeof body.fixture === "string" ? body.fixture.trim().toUpperCase() : "BANK-001";
      const institution = syntheticBankInstitutions.find((item) => item.institution_id === institutionId && item.availability.status === "AVAILABLE");
      if (!institution || fixture !== "BANK-001" || !/^https?:\/\/localhost(?::\d+)?\//.test(redirectUri) || !["nl", "en"].includes(language) || !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) {
        json(res, 400, { error: "INVALID_BANK_REQUISITION_INPUT" });
        return true;
      }
      const state = randomBytes(24).toString("base64url");
      const code = randomBytes(24).toString("base64url");
      const requisitionId = `synthetic-requisition-${randomUUID()}`;
      const provider = await databasePool.query(`INSERT INTO spaartrack.provider (slug, name, provider_type, api_version, region, status, capabilities) VALUES ('gocardless', 'GoCardless Synthetic', 'AGGREGATOR', 'synthetic-bank-v1', 'EU', 'ACTIVE', $1) ON CONFLICT (slug) DO UPDATE SET status = 'ACTIVE' RETURNING id`, [JSON.stringify({ auth_mode: "OPEN_BANKING_REQUISITION", read_only: true })]);
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        const connection = await client.query(`INSERT INTO spaartrack.external_connection (user_id, provider_id, auth_mode, status, display_name, provider_metadata) VALUES ($1, $2, 'OPEN_BANKING_REQUISITION', 'AUTH_PENDING', $3, $4) RETURNING id`, [userId, provider.rows[0].id, institution.name, JSON.stringify({ read_only: true, fixture, institution_id: institution.institution_id, redirect_uri: redirectUri, language })]);
        await client.query(`INSERT INTO spaartrack.consent_record (connection_id, consent_type, external_consent_id, state, scopes, expires_at, metadata) VALUES ($1, 'OPEN_BANKING', $2, 'PENDING', $3, now() + interval '5 minutes', $4)`, [connection.rows[0].id, requisitionId, JSON.stringify(["accounts:read", "balances:read", "transactions:read"]), JSON.stringify({ state_hash: sessionHash(state), code_hash: sessionHash(code), code_challenge: codeChallenge, redirect_uri: redirectUri, language, fixture, institution_id: institution.institution_id })]);
        await client.query("COMMIT");
        const authorizationUrl = new URL(`/api/v1/bank-requisitions/callback`, `http://${req.headers.host || "localhost:18080"}`);
        authorizationUrl.searchParams.set("state", state);
        authorizationUrl.searchParams.set("code", code);
        authorizationUrl.searchParams.set("requisition_id", requisitionId);
        json(res, 201, { requisition_id: requisitionId, connection_id: connection.rows[0].id, institution_id: institution.institution_id, provider_slug: "gocardless", redirect_uri: redirectUri, language, consent_state: "PENDING", authorization_url: authorizationUrl.toString(), expires_at: new Date(Date.now() + 300_000).toISOString(), calculation_version: "bank-consent-v1", read_only: true });
      } catch (error) {
        await client.query("ROLLBACK");
        console.error(redactedLog({ level: "error", operation: "bank_requisition_create_failed", error: (error as Error).message }));
        json(res, 400, { error: "BANK_REQUISITION_CREATE_FAILED" });
      } finally { client.release(); }
      return true;
    }
    if (req.method === "GET" && callbackPath) {
      const state = parsed.searchParams.get("state") || "";
      const code = parsed.searchParams.get("code") || "";
      const requisitionId = parsed.searchParams.get("requisition_id") || "";
      const codeVerifier = parsed.searchParams.get("code_verifier") || "";
      const pending = await databasePool.query(`SELECT cr.id, cr.connection_id, cr.state, cr.metadata, ec.user_id, ec.status AS connection_status FROM spaartrack.consent_record cr JOIN spaartrack.external_connection ec ON ec.id = cr.connection_id WHERE cr.external_consent_id = $1 AND ec.user_id = $2`, [requisitionId, userId]);
      if (!pending.rowCount) { json(res, 401, { error: "CONSENT_STATE_INVALID_OR_EXPIRED" }); return true; }
      const record = pending.rows[0] as Record<string, unknown>;
      const metadata = record.metadata as Record<string, unknown>;
      const validState = sessionHash(state) === metadata.state_hash && sessionHash(code) === metadata.code_hash;
      const expectedChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
      if (!validState || !codeVerifier || expectedChallenge !== metadata.code_challenge) { json(res, 401, { error: "CONSENT_STATE_INVALID_OR_EXPIRED" }); return true; }
      if (record.state === "AUTHORIZED") { json(res, 409, { error: "CONSENT_REPLAYED" }); return true; }
      if (record.state !== "PENDING") { json(res, 401, { error: "CONSENT_STATE_INVALID_OR_EXPIRED" }); return true; }
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`UPDATE spaartrack.consent_record SET state = 'AUTHORIZED', authorized_at = now(), expires_at = now() + interval '90 days', metadata = metadata || $1::jsonb WHERE id = $2`, [JSON.stringify({ callback: "synthetic", csrf_validated: true, pkce_validated: true }), record.id]);
        await client.query(`UPDATE spaartrack.external_connection SET status = 'AUTHORIZED', consent_expires_at = now() + interval '90 days', updated_at = now() WHERE id = $1`, [record.connection_id]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
      await auditEvent(req, res, userId, "BANK_CONSENT_AUTHORIZED", "CONSENT_RECORD", String(record.id), { fixture: "BANK-001", csrf_validated: true, pkce_validated: true });
      json(res, 200, { requisition_id: requisitionId, connection_id: record.connection_id, consent_state: "AUTHORIZED", connection_status: "AUTHORIZED", calculation_version: "bank-consent-v1", read_only: true });
      return true;
    }
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "bank_requisition_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "BANK_REQUISITION_REQUEST_FAILED" });
  }
  return true;
}

async function bankAccountSelectionRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const match = req.url?.match(/^\/api\/v1\/bank-requisitions\/([a-z0-9-]+)\/accounts(?:\?.*)?$/i);
  if (environment !== "local" || !match) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const requisitionId = match[1];
  try {
    const consent = await databasePool.query(`
      SELECT cr.connection_id, cr.state, ec.provider_metadata
      FROM spaartrack.consent_record cr
      JOIN spaartrack.external_connection ec ON ec.id = cr.connection_id
      WHERE cr.external_consent_id = $1 AND ec.user_id = $2 AND cr.consent_type = 'OPEN_BANKING'
      ORDER BY cr.created_at DESC LIMIT 1`, [requisitionId, userId]);
    if (!consent.rowCount) { json(res, 404, { error: "BANK_REQUISITION_NOT_FOUND" }); return true; }
    const record = consent.rows[0] as Record<string, unknown>;
    if (record.state !== "AUTHORIZED") { json(res, 409, { error: "BANK_CONSENT_REQUIRED" }); return true; }
    const metadata = (record.provider_metadata || {}) as Record<string, unknown>;
    const institutionId = String(metadata.institution_id || "");
    const available = syntheticBankAccounts.filter((account) => account.institution_id === institutionId);
    const connectionId = String(record.connection_id);
    const selectedRows = await databasePool.query(`SELECT external_account_id FROM spaartrack.provider_account WHERE connection_id = $1 AND is_active = true`, [connectionId]);
    const selectedIds = selectedRows.rows.map((row) => String(row.external_account_id));
    if (req.method === "GET") {
      json(res, 200, { requisition_id: requisitionId, institution_id: institutionId, accounts: available.map((account) => ({ ...account, selected: selectedIds.includes(account.id) })), selected_account_ids: selectedIds, calculation_version: "bank-account-selection-v1", fixture: "BANK-001", read_only: true });
      return true;
    }
    if (req.method !== "POST") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
    const body = await readJson(req);
    const fixture = typeof body.fixture === "string" ? body.fixture.trim().toUpperCase() : "BANK-001";
    const requested = Array.isArray(body.selected_account_ids) ? body.selected_account_ids.filter((item): item is string => typeof item === "string") : [];
    const uniqueIds = [...new Set(requested)];
    if (fixture !== "BANK-001" || !uniqueIds.length || uniqueIds.some((id) => !available.some((account) => account.id === id))) {
      json(res, 400, { error: "INVALID_BANK_ACCOUNT_SELECTION" }); return true;
    }
    const client = await databasePool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE spaartrack.provider_account SET is_active = false, updated_at = now() WHERE connection_id = $1`, [connectionId]);
      for (const account of available.filter((item) => uniqueIds.includes(item.id))) {
        await client.query(`INSERT INTO spaartrack.provider_account (connection_id, external_account_id, account_type, name, base_currency_code, provider_metadata, is_active) VALUES ($1, $2, $3, $4, $5, $6, true) ON CONFLICT (connection_id, external_account_id) DO UPDATE SET account_type = EXCLUDED.account_type, name = EXCLUDED.name, base_currency_code = EXCLUDED.base_currency_code, provider_metadata = EXCLUDED.provider_metadata, is_active = true, updated_at = now()`, [connectionId, account.id, account.account_type, account.name, account.base_currency_code, JSON.stringify({ fixture: "BANK-001", provider_account_id: account.provider_account_id, currency_code: account.currency_code })]);
      }
      await client.query(`UPDATE spaartrack.external_connection SET provider_metadata = provider_metadata || $1::jsonb, updated_at = now() WHERE id = $2`, [JSON.stringify({ selected_account_ids: uniqueIds }), connectionId]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    await auditEvent(req, res, userId, "BANK_ACCOUNT_SELECTION_UPDATED", "EXTERNAL_CONNECTION", connectionId, { fixture: "BANK-001", selected_account_ids: uniqueIds, ledger_untouched: true });
    json(res, 200, { requisition_id: requisitionId, institution_id: institutionId, accounts: available.filter((account) => uniqueIds.includes(account.id)).map((account) => ({ ...account, selected: true })), selected_account_ids: uniqueIds, calculation_version: "bank-account-selection-v1", fixture: "BANK-001", read_only: true, ledger_untouched: true });
    return true;
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "bank_account_selection_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "BANK_ACCOUNT_SELECTION_REQUEST_FAILED" });
    return true;
  }
}

async function bankSyncRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const match = req.url?.match(/^\/api\/v1\/bank-requisitions\/([a-z0-9-]+)\/sync(?:\?.*)?$/i);
  if (environment !== "local" || !match) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "POST") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  const requisitionId = match[1];
  try {
    const body = await readJson(req);
    const fixture = typeof body.fixture === "string" ? body.fixture.trim().toUpperCase() : "BANK-001";
    const scenario = typeof body.scenario === "string" ? body.scenario.trim().toUpperCase() : "SUCCESS";
    const cursor = typeof body.cursor === "string" ? body.cursor.trim() : "";
    const windowFrom = typeof body.window_from === "string" ? body.window_from.trim() : "";
    const windowTo = typeof body.window_to === "string" ? body.window_to.trim() : "";
    if (fixture !== "BANK-001" || !cursor || !windowFrom || !windowTo || Number.isNaN(Date.parse(windowFrom)) || Number.isNaN(Date.parse(windowTo)) || windowFrom >= windowTo) {
      json(res, 400, { error: "INVALID_BANK_SYNC_WINDOW" }); return true;
    }
    const consent = await databasePool.query(`SELECT cr.connection_id, cr.state, ec.provider_metadata, ec.status, p.slug AS provider_slug FROM spaartrack.consent_record cr JOIN spaartrack.external_connection ec ON ec.id = cr.connection_id JOIN spaartrack.provider p ON p.id = ec.provider_id WHERE cr.external_consent_id = $1 AND ec.user_id = $2 AND cr.consent_type = 'OPEN_BANKING' ORDER BY cr.created_at DESC LIMIT 1`, [requisitionId, userId]);
    if (!consent.rowCount) { json(res, 404, { error: "BANK_REQUISITION_NOT_FOUND" }); return true; }
    const record = consent.rows[0] as Record<string, unknown>;
    if (record.state !== "AUTHORIZED" || record.status === "REVOKED" || record.status === "DISCONNECTED") { json(res, 409, { error: "BANK_CONSENT_REQUIRED" }); return true; }
    const connectionId = String(record.connection_id);
    const accountRows = await databasePool.query(`SELECT id, external_account_id, account_type, base_currency_code, provider_metadata FROM spaartrack.provider_account WHERE connection_id = $1 AND is_active = true ORDER BY external_account_id`, [connectionId]);
    if (!accountRows.rowCount) { json(res, 409, { error: "BANK_ACCOUNTS_REQUIRED" }); return true; }
    const providerErrors: Record<string, { code: string; status_code: number; retryable: boolean }> = {
      AUTH_401: { code: "PROVIDER_UNAUTHORIZED", status_code: 401, retryable: false },
      PROVIDER_429: { code: "PROVIDER_RATE_LIMITED", status_code: 429, retryable: true }
    };
    const providerError = providerErrors[scenario];
    const client = await databasePool.connect();
    try {
      await client.query("BEGIN");
      if (providerError) {
        const run = await client.query(`INSERT INTO spaartrack.sync_run (connection_id, status, trigger_type, cursor_before, cursor_after, window_from, window_to, started_at, finished_at, records_seen, error_code, error_message, diagnostics) SELECT $1, 'FAILED', 'MANUAL', provider_cursor, $2, $3::timestamptz, $4::timestamptz, now(), now(), 0, $5, $6, $7::jsonb FROM spaartrack.sync_checkpoint WHERE connection_id = $1 UNION ALL SELECT $1, 'FAILED', 'MANUAL', NULL, $2, $3::timestamptz, $4::timestamptz, now(), now(), 0, $5, $6, $7::jsonb WHERE NOT EXISTS (SELECT 1 FROM spaartrack.sync_checkpoint WHERE connection_id = $1) RETURNING id`, [connectionId, cursor, windowFrom, windowTo, providerError.code, `Synthetic BANK-001 provider error ${providerError.status_code}`, JSON.stringify({ provider_status_code: providerError.status_code, retryable: providerError.retryable })]);
        await client.query(`UPDATE spaartrack.external_connection SET status = 'ERROR', last_error_code = $1, last_error_message = $2, last_sync_started_at = now(), last_sync_completed_at = now(), updated_at = now() WHERE id = $3`, [providerError.code, `Synthetic BANK-001 provider error ${providerError.status_code}`, connectionId]);
        await client.query("COMMIT");
        json(res, 200, { status: "FAILED", connection_id: connectionId, sync_run_id: run.rows[0].id, provider_error: providerError, incremental_window: { from: windowFrom, to: windowTo }, read_only: true, calculation_version: "bank-transaction-sync-v1" });
        return true;
      }
      const asOf = new Date().toISOString();
      const balances = accountRows.rows.map((account, index) => ({ account_id: account.external_account_id, currency_code: account.base_currency_code, balance: index === 0 ? "1250.00" : "2500.00", as_of: asOf, provider_id: `bank-001-${account.external_account_id.replace("synthetic-nl-", "")}` }));
      const transactions = accountRows.rows.map((account, index) => ({ external_id: `bank-001-${account.external_account_id}-transaction-001`, account_id: account.external_account_id, normalized_amount: index === 0 ? "-42.50" : "75.00", currency_code: account.base_currency_code, occurred_at: `${windowTo}`, description: index === 0 ? "Synthetic BANK-001 groceries" : "Synthetic BANK-001 salary", dedupe_key: `BANK-001:${account.external_account_id}:transaction-001` }));
      const ids = transactions.map((transaction) => transaction.external_id);
      const prior = await client.query(`SELECT sri.external_id FROM spaartrack.sync_result_item sri JOIN spaartrack.external_connection prior_ec ON prior_ec.id = sri.connection_id WHERE prior_ec.user_id = $1 AND sri.external_id = ANY($2::text[])`, [userId, ids]);
      const priorIds = new Set(prior.rows.map((row) => String(row.external_id)));
      const duplicateCount = transactions.filter((transaction) => priorIds.has(transaction.external_id)).length;
      const run = await client.query(`INSERT INTO spaartrack.sync_run (connection_id, status, trigger_type, cursor_before, cursor_after, window_from, window_to, started_at, finished_at, records_seen, records_created, records_duplicate, diagnostics) SELECT $1, 'SUCCEEDED', 'MANUAL', provider_cursor, $2, $3::timestamptz, $4::timestamptz, now(), now(), $5, $6, $7, $8::jsonb FROM (SELECT provider_cursor FROM spaartrack.sync_checkpoint WHERE connection_id = $1 UNION ALL SELECT NULL WHERE NOT EXISTS (SELECT 1 FROM spaartrack.sync_checkpoint WHERE connection_id = $1) LIMIT 1) checkpoint RETURNING id, cursor_before`, [connectionId, cursor, windowFrom, windowTo, transactions.length, transactions.length - duplicateCount, duplicateCount, JSON.stringify({ fixture, balance_snapshots: balances.length, transaction_count: transactions.length, incremental_window: { from: windowFrom, to: windowTo } })]);
      const payload = JSON.stringify({ fixture, cursor, window_from: windowFrom, window_to: windowTo, balances, transactions });
      const raw = await client.query(`INSERT INTO spaartrack.raw_provider_payload (connection_id, sync_run_id, payload_type, provider_endpoint, content_type, payload_json, checksum_sha256, schema_version) VALUES ($1, $2, 'API_RESPONSE', $3, 'application/json', $4, $5, 'bank-001-v1') RETURNING id`, [connectionId, run.rows[0].id, `${record.provider_slug}/bank-sync`, payload, createHash("sha256").update(payload).digest("hex")]);
      for (const transaction of transactions) {
        await client.query(`INSERT INTO spaartrack.sync_result_item (sync_run_id, connection_id, external_id, item_type, payload_json) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (sync_run_id, external_id) DO NOTHING`, [run.rows[0].id, connectionId, transaction.external_id, priorIds.has(transaction.external_id) ? "DUPLICATE" : "NEW", JSON.stringify(transaction)]);
      }
      for (const balance of balances) await client.query(`UPDATE spaartrack.provider_account SET provider_metadata = provider_metadata || $1::jsonb, updated_at = now() WHERE connection_id = $2 AND external_account_id = $3`, [JSON.stringify({ last_balance: balance.balance, last_balance_currency: balance.currency_code, balance_as_of: balance.as_of, balance_provider_id: balance.provider_id, balance_snapshot_version: "bank-balance-snapshot-v1", sync_payload_id: raw.rows[0].id }), connectionId, balance.account_id]);
      await client.query(`INSERT INTO spaartrack.sync_checkpoint (connection_id, provider_cursor, last_activity_at, last_balance_at) VALUES ($1, $2, $3, $3) ON CONFLICT (connection_id) DO UPDATE SET provider_cursor = EXCLUDED.provider_cursor, last_activity_at = EXCLUDED.last_activity_at, last_balance_at = EXCLUDED.last_balance_at, updated_at = now()`, [connectionId, cursor, asOf]);
      await client.query(`UPDATE spaartrack.external_connection SET status = 'HEALTHY', last_sync_started_at = now(), last_sync_completed_at = now(), last_successful_sync_at = now(), last_error_code = NULL, last_error_message = NULL, updated_at = now() WHERE id = $1`, [connectionId]);
      await client.query("COMMIT");
      await auditEvent(req, res, userId, "BANK_SYNC_COMPLETED", "EXTERNAL_CONNECTION", connectionId, { fixture, cursor, records_created: transactions.length - duplicateCount, records_duplicate: duplicateCount, ledger_untouched: true });
      json(res, 200, { status: "SUCCEEDED", connection_id: connectionId, sync_run_id: run.rows[0].id, cursor_before: run.rows[0].cursor_before, cursor_after: cursor, incremental_window: { from: windowFrom, to: windowTo }, balance_snapshots: balances, transactions, records_created: transactions.length - duplicateCount, dedupe: { duplicates: duplicateCount, strategy: "cross_connection_external_id" }, freshness: { status: "FRESH", as_of: asOf, max_age_hours: 48 }, calculation_version: "bank-transaction-sync-v1", balance_calculation_version: "bank-balance-snapshot-v1", raw_payload_id: raw.rows[0].id, no_double_counting: true, read_only: true, ledger_untouched: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(redactedLog({ level: "error", operation: "bank_sync_failed", error: (error as Error).message }));
      if (!res.writableEnded) json(res, 400, { error: "BANK_SYNC_FAILED" });
    } finally { client.release(); }
    return true;
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "bank_sync_request_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "BANK_SYNC_REQUEST_FAILED" });
    return true;
  }
}

async function bankRevokeRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const match = req.url?.match(/^\/api\/v1\/bank-requisitions\/([a-z0-9-]+)\/revoke(?:\?.*)?$/i);
  if (environment !== "local" || !match) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "POST") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const requisitionId = match[1];
    const consent = await databasePool.query(`SELECT cr.id AS consent_id, cr.connection_id, cr.state, ec.status, p.slug AS provider_slug FROM spaartrack.consent_record cr JOIN spaartrack.external_connection ec ON ec.id = cr.connection_id JOIN spaartrack.provider p ON p.id = ec.provider_id WHERE cr.external_consent_id = $1 AND ec.user_id = $2 AND cr.consent_type = 'OPEN_BANKING' ORDER BY cr.created_at DESC LIMIT 1`, [requisitionId, userId]);
    if (!consent.rowCount) { json(res, 404, { error: "BANK_REQUISITION_NOT_FOUND" }); return true; }
    const record = consent.rows[0] as Record<string, unknown>;
    if (record.status === "DISCONNECTED" || record.status === "REVOKED" || record.state === "REVOKED") { json(res, 409, { error: "BANK_CONNECTION_ALREADY_DISCONNECTED" }); return true; }
    const client = await databasePool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE spaartrack.consent_record SET state = 'REVOKED', revoked_at = now(), metadata = metadata || $1::jsonb WHERE id = $2`, [JSON.stringify({ provider_revoke_called: true, provider_revoke_status: "REVOKED", fixture: "BANK-001" }), record.consent_id]);
      await client.query(`UPDATE spaartrack.external_connection SET status = 'DISCONNECTED', disconnected_at = now(), updated_at = now(), provider_metadata = provider_metadata || $1::jsonb WHERE id = $2`, [JSON.stringify({ provider_revoke_called: true, provider_revoke_status: "REVOKED", secret_cleanup: "credential_reference_revoked" }), record.connection_id]);
      await client.query(`UPDATE spaartrack.provider_account SET is_active = false, updated_at = now() WHERE connection_id = $1`, [record.connection_id]);
      await client.query(`UPDATE spaartrack.credential_secret_ref SET revoked_at = now() WHERE id = (SELECT credential_ref_id FROM spaartrack.external_connection WHERE id = $1) AND revoked_at IS NULL`, [record.connection_id]);
      await client.query(`UPDATE spaartrack.connection_scope SET revoked_at = now() WHERE connection_id = $1 AND revoked_at IS NULL`, [record.connection_id]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    await auditEvent(req, res, userId, "BANK_CONNECTION_REVOKED", "EXTERNAL_CONNECTION", String(record.connection_id), { fixture: "BANK-001", provider_revoke: "REVOKED", secret_cleanup: "credential_reference_revoked", ledger_untouched: true });
    json(res, 200, { requisition_id: requisitionId, connection_id: record.connection_id, status: "DISCONNECTED", provider_revoke: { called: true, status: "REVOKED", provider: record.provider_slug }, secret_cleanup: { credential_reference_revoked: true, token_material: "not_stored" }, calculation_version: "bank-connection-revoke-v1", read_only: true, ledger_untouched: true });
    return true;
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "bank_revoke_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "BANK_REVOKE_FAILED" });
    return true;
  }
}

async function bunqOAuthDeploymentGateRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/bunq-oauth/deployment-gate")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "POST") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const body = await readJson(req);
    const fixture = typeof body.fixture === "string" ? body.fixture.trim().toUpperCase() : "";
    const provider = typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "";
    const scopes = Array.isArray(body.scopes) ? body.scopes.filter((scope): scope is string => typeof scope === "string").map((scope) => scope.trim().toLowerCase()) : [];
    const redirectUri = typeof body.redirect_uri === "string" ? body.redirect_uri.trim() : "";
    const legalDecision = typeof body.legal_decision === "string" ? body.legal_decision.trim().toUpperCase() : "";
    const readOnlyPermissions = body.read_only_permissions === true;
    const failures: string[] = [];
    const requiredScopes = ["accounts:read", "balances:read", "transactions:read"];
    if (fixture !== "BANK-001") failures.push("BANK_FIXTURE_REQUIRED");
    if (provider !== "bunq") failures.push("BUNQ_PROVIDER_REQUIRED");
    if (requiredScopes.some((scope) => !scopes.includes(scope)) || scopes.some((scope) => scope.endsWith(":write") || scope.includes("payment"))) failures.push("READ_ONLY_SCOPE_REQUIRED");
    if (redirectUri !== "http://localhost:3000/bunq/callback") failures.push("REDIRECT_URI_NOT_ALLOWED");
    if (legalDecision !== "APPROVED") failures.push("LEGAL_DECISION_REQUIRED");
    if (!readOnlyPermissions) failures.push("READ_ONLY_PERMISSION_REQUIRED");
    const eligible = failures.length === 0;
    await auditEvent(req, res, userId, eligible ? "BUNQ_OAUTH_GATE_APPROVED" : "BUNQ_OAUTH_GATE_BLOCKED", "BUNQ_OAUTH_DEPLOYMENT_GATE", userId, { fixture, provider, scopes, redirect_uri: redirectUri, legal_decision: legalDecision, read_only_permissions: readOnlyPermissions, failures, eligible });
    json(res, eligible ? 200 : 409, { eligible, provider: "bunq", fixture: fixture || "BANK-001", gate_failures: failures, oauth_status: eligible ? "NOT_ACTIVATED" : "BUNQ_OAUTH_DISABLED", human_approval_required: true, activation: eligible ? "READY_FOR_EXPLICIT_ACTIVATION" : "BLOCKED", compliance_check: { scopes: requiredScopes, redirect_uri: redirectUri, legal_decision: legalDecision, read_only_permissions: readOnlyPermissions }, calculation_version: "bunq-oauth-deployment-gate-v1", read_only: true });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "bunq_oauth_gate_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "BUNQ_OAUTH_GATE_FAILED" });
  }
  return true;
}

async function bankRequisitionExpiryRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const match = req.url?.match(/^\/api\/v1\/bank-requisitions\/([a-z0-9-]+)\/(expire|status)(?:\?.*)?$/i);
  if (environment !== "local" || !match) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  try {
    const requisitionId = match[1];
    const action = match[2].toLowerCase();
    const consent = await databasePool.query(`SELECT cr.id AS consent_id, cr.connection_id, cr.state, ec.status, (SELECT COUNT(*)::integer FROM spaartrack.raw_provider_payload rpp WHERE rpp.connection_id = ec.id) AS historical_payloads, (SELECT COUNT(*)::integer FROM spaartrack.sync_run sr WHERE sr.connection_id = ec.id AND sr.status = 'SUCCEEDED') AS historical_syncs FROM spaartrack.consent_record cr JOIN spaartrack.external_connection ec ON ec.id = cr.connection_id WHERE cr.external_consent_id = $1 AND ec.user_id = $2 AND cr.consent_type = 'OPEN_BANKING' ORDER BY cr.created_at DESC LIMIT 1`, [requisitionId, userId]);
    if (!consent.rowCount) { json(res, 404, { error: "BANK_REQUISITION_NOT_FOUND" }); return true; }
    const record = consent.rows[0] as Record<string, unknown>;
    if (action === "status" && req.method === "GET") {
      json(res, 200, { requisition_id: requisitionId, status: record.state === "AUTHORIZED" ? record.status : record.state, historical_payloads: record.historical_payloads, historical_syncs: record.historical_syncs, historical_data_preserved: true, reconnect_required: record.state === "EXPIRED" || record.status === "EXPIRED", calculation_version: "bank-reconnect-v1", no_double_counting: true, read_only: true });
      return true;
    }
    if (action !== "expire" || req.method !== "POST") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
    if (record.state === "EXPIRED" || record.status === "EXPIRED") { json(res, 409, { error: "BANK_CONSENT_ALREADY_EXPIRED" }); return true; }
    const client = await databasePool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE spaartrack.consent_record SET state = 'EXPIRED', expires_at = now(), metadata = metadata || $1::jsonb WHERE id = $2`, [JSON.stringify({ synthetic_expiry: true, historical_data_preserved: true, reconnect_required: true }), record.consent_id]);
      await client.query(`UPDATE spaartrack.external_connection SET status = 'EXPIRED', consent_expires_at = now(), updated_at = now() WHERE id = $1`, [record.connection_id]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    await auditEvent(req, res, userId, "BANK_CONSENT_EXPIRED", "CONSENT_RECORD", String(record.consent_id), { fixture: "BANK-001", historical_data_preserved: true, reconnect_required: true, no_double_counting: true });
    json(res, 200, { requisition_id: requisitionId, status: "EXPIRED", historical_payloads: record.historical_payloads, historical_syncs: record.historical_syncs, historical_data_preserved: true, reconnect_required: true, calculation_version: "bank-reconnect-v1", no_double_counting: true, read_only: true });
    return true;
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "bank_requisition_expiry_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "BANK_RECONNECT_FAILED" });
    return true;
  }
}

async function alertRuleRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/alert-rules") && !req.url?.startsWith("/api/v1/notifications")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    if (parsed.pathname === "/api/v1/notifications" && req.method === "GET") {
      const alertRuleId = parsed.searchParams.get("alert_rule_id")?.trim() || "";
      if (alertRuleId && !/^[0-9a-f-]{36}$/i.test(alertRuleId)) { json(res, 400, { error: "INVALID_NOTIFICATION_QUERY" }); return true; }
      const values: unknown[] = [userId];
      const clause = alertRuleId ? ` AND alert_rule_id = $${values.push(alertRuleId)}` : "";
      const result = await databasePool.query(`SELECT id, alert_rule_id, notification_type, title, body, severity, payload, read_at, delivered_at, created_at FROM spaartrack.notification WHERE user_id = $1${clause} ORDER BY created_at DESC`, values);
      json(res, 200, { notifications: result.rows, calculation_version: "alert-delivery-history-v1" });
      return true;
    }
    if (parsed.pathname === "/api/v1/alert-rules" && req.method === "GET") {
      const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) { json(res, 400, { error: "INVALID_ALERT_QUERY" }); return true; }
      const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
      const result = await databasePool.query(`SELECT id, portfolio_id, name, alert_type, condition_json AS condition, channels, is_active, last_triggered_at, created_at FROM spaartrack.alert_rule WHERE user_id = $1 AND portfolio_id = $2 ORDER BY created_at DESC`, [userId, portfolioId]);
      json(res, 200, { alert_rules: result.rows, calculation_version: "alert-rule-v1" });
      return true;
    }
    const match = parsed.pathname.match(/^\/api\/v1\/alert-rules\/([0-9a-f-]{36})(\/test)?$/i);
    if (match) {
      const rule = await databasePool.query(`SELECT ar.id, ar.user_id, ar.portfolio_id, ar.name, ar.alert_type, ar.condition_json, ar.channels, ar.is_active FROM spaartrack.alert_rule ar JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = ar.portfolio_id AND pm.user_id = $2 AND pm.revoked_at IS NULL WHERE ar.id = $1 AND ar.user_id = $2`, [match[1], userId]);
      if (!rule.rowCount) { json(res, 404, { error: "ALERT_RULE_NOT_FOUND" }); return true; }
      const current = rule.rows[0];
      if (match[2] && req.method === "POST") {
        const body = await readJson(req);
        const deliveryHistory = [{ status: "TESTED", channels: current.channels, tested_at: new Date().toISOString(), event: body.event || {} }];
        const notification = await databasePool.query(`INSERT INTO spaartrack.notification (user_id, alert_rule_id, notification_type, title, body, severity, payload, delivered_at) VALUES ($1, $2, 'ALERT_TEST', $3, $4, 'INFO', $5, now()) RETURNING id, alert_rule_id, notification_type, title, body, severity, payload, read_at, delivered_at, created_at`, [userId, current.id, current.name, `Test delivery for ${current.alert_type}`, JSON.stringify({ delivery_history: deliveryHistory, calculation_version: "alert-delivery-history-v1" })]);
        json(res, 201, notification.rows[0]);
        return true;
      }
      if (req.method === "PATCH") {
        const body = await readJson(req);
        if (typeof body.is_active !== "boolean") { json(res, 400, { error: "INVALID_ALERT_UPDATE" }); return true; }
        const updated = await databasePool.query(`UPDATE spaartrack.alert_rule SET is_active = $2 WHERE id = $1 RETURNING id, portfolio_id, name, alert_type, condition_json AS condition, channels, is_active, last_triggered_at, created_at`, [current.id, body.is_active]);
        json(res, 200, updated.rows[0]);
        return true;
      }
      json(res, 405, { error: "METHOD_NOT_ALLOWED" });
      return true;
    }
    if (parsed.pathname === "/api/v1/alert-rules" && req.method === "POST") {
      const body = await readJson(req);
      const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const alertType = typeof body.alert_type === "string" ? body.alert_type.trim().toUpperCase() : "";
      const condition = body.condition && typeof body.condition === "object" ? body.condition : null;
      const channels = Array.isArray(body.channels) ? body.channels.map((channel) => typeof channel === "string" ? channel.trim().toUpperCase() : "") : [];
      if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !name || !alertType || !condition || channels.length === 0 || channels.some((channel) => !alertChannels.includes(channel as typeof alertChannels[number]))) { json(res, 400, { error: "INVALID_ALERT_RULE_INPUT" }); return true; }
      const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL AND role IN ('OWNER', 'EDITOR')`, [portfolioId, userId]);
      if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
      const result = await databasePool.query(`INSERT INTO spaartrack.alert_rule (user_id, portfolio_id, name, alert_type, condition_json, channels) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, portfolio_id, name, alert_type, condition_json AS condition, channels, is_active, last_triggered_at, created_at`, [userId, portfolioId, name, alertType, JSON.stringify(condition), JSON.stringify(channels)]);
      json(res, 201, result.rows[0]);
      return true;
    }
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "alert_rule_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "ALERT_RULE_REQUEST_FAILED" });
  }
  return true;
}

async function performanceComparisonRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/performance-comparison")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "GET") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const parsed = new URL(req.url, "http://localhost");
    const portfolioId = parsed.searchParams.get("portfolio_id")?.trim() || "";
    const periodStart = parsed.searchParams.get("period_start")?.trim() || "";
    const periodEnd = parsed.searchParams.get("period_end")?.trim() || "";
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) {
      json(res, 400, { error: "INVALID_PERFORMANCE_QUERY" }); return true;
    }
    const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ACCESS_FORBIDDEN" }); return true; }
    const snapshots = await databasePool.query(`SELECT snapshot_at::text, portfolio_value::text FROM spaartrack.portfolio_snapshot WHERE portfolio_id = $1 AND snapshot_at::date IN ($2::date, $3::date) ORDER BY snapshot_at DESC`, [portfolioId, periodStart, periodEnd]);
    const startSnapshot = snapshots.rows.find((row) => String(row.snapshot_at).slice(0, 10) === periodStart);
    const endSnapshot = snapshots.rows.find((row) => String(row.snapshot_at).slice(0, 10) === periodEnd);
    if (!startSnapshot || !endSnapshot) { json(res, 409, { error: "PERFORMANCE_SNAPSHOTS_REQUIRED", required: { period_start: periodStart, period_end: periodEnd } }); return true; }
    const flowRows = await databasePool.query(
      `SELECT lt.effective_date::text, lt.activity_type, le.amount::text, le.currency_code
         FROM spaartrack.ledger_transaction lt
         JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
        WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED' AND lt.is_external_flow = true
          AND lt.effective_date > $2::date AND lt.effective_date <= $3::date
          AND lt.activity_type IN ('DEPOSIT', 'WITHDRAWAL')
        ORDER BY lt.effective_date, lt.id`, [portfolioId, periodStart, periodEnd]
    );
    const cashflows = flowRows.rows.map((row) => ({ date: String(row.effective_date), activity_type: row.activity_type, amount: fixedAmount((row.activity_type === "WITHDRAWAL" ? -1 : 1) * Number(row.amount || 0)), currency_code: row.currency_code }));
    const startValue = Number(startSnapshot.portfolio_value || 0);
    const endValue = Number(endSnapshot.portfolio_value || 0);
    const netCashFlow = cashflows.reduce((sum, flow) => sum + Number(flow.amount), 0);
    const startMs = new Date(`${periodStart}T00:00:00.000Z`).getTime();
    const endMs = new Date(`${periodEnd}T00:00:00.000Z`).getTime();
    const days = Math.max(1, (endMs - startMs) / (24 * 60 * 60 * 1000));
    const twrPct = startValue > 0 ? (endValue - netCashFlow) / startValue * 100 : netCashFlow > 0 ? (endValue / netCashFlow - 1) * 100 : null;
    const dietzDenominator = startValue + cashflows.reduce((sum, flow) => {
      const weight = (endMs - new Date(`${flow.date}T00:00:00.000Z`).getTime()) / (endMs - startMs || 1);
      return sum + Number(flow.amount) * weight;
    }, 0);
    const dietzPct = dietzDenominator !== 0 ? (endValue - startValue - netCashFlow) / dietzDenominator * 100 : null;
    const xirrPct = xirr(cashflows.map((flow) => ({ amount: Number(flow.amount), date: `${flow.date}T00:00:00.000Z` })), endValue, `${periodEnd}T00:00:00.000Z`);
    const method = (name: string, returnPct: number | null, formulaVersion: string, limitations: string) => ({ method: name, period_start: periodStart, period_end: periodEnd, return_pct: returnPct === null ? null : fixedAmount(returnPct), annualized_return_pct: annualizeReturn(returnPct, days), net_cash_flow: fixedAmount(netCashFlow), cashflows, formula_version: formulaVersion, limitations });
    json(res, 200, {
      portfolio_id: portfolioId,
      period_start: periodStart,
      period_end: periodEnd,
      beginning_value: fixedAmount(startValue),
      ending_value: fixedAmount(endValue),
      cashflows,
      calculation_version: "performance-comparison-v1",
      assumptions: "Snapshot values are the read-model inputs; external deposits/withdrawals are date-weighted and no internal transfer is counted as a flow.",
      methods: {
        TWR: method("TWR", twrPct, "twr-v1", "Requires period boundary snapshots; external cashflows are neutralized.") ,
        MWRR: method("MWRR", xirrPct, "xirr-v1", "Annualized money-weighted return; null when no valid IRR root exists."),
        IRR: method("IRR", xirrPct, "xirr-v1", "Same dated cashflow root as MWRR; annualized and sensitive to cashflow timing."),
        MODIFIED_DIETZ: method("MODIFIED_DIETZ", dietzPct, "modified-dietz-v1", "Uses linear time weights; not equivalent to daily-linked TWR.")
      }
    });
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "performance_comparison_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "PERFORMANCE_COMPARISON_FAILED" });
  }
  return true;
}

async function importCommitRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/import-sessions/")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const match = req.url.match(/^\/api\/v1\/import-sessions\/([0-9a-f-]{36})\/commit$/i);
  if (!match || req.method !== "POST") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  const client = await databasePool.connect();
  try {
    const body = await readJson(req);
    const accountId = typeof body.financial_account_id === "string" ? body.financial_account_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(accountId)) { json(res, 400, { error: "INVALID_IMPORT_COMMIT_REQUEST" }); return true; }
    const session = await client.query(
      `SELECT s.id, s.portfolio_id, s.status
       FROM spaartrack.import_session s
       JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = s.portfolio_id
       JOIN spaartrack.financial_account fa ON fa.portfolio_id = s.portfolio_id
       WHERE s.id = $1 AND pm.user_id = $2 AND pm.revoked_at IS NULL
         AND pm.role IN ('OWNER', 'EDITOR') AND fa.id = $3`, [match[1], userId, accountId]
    );
    if (!session.rowCount) { json(res, 404, { error: "IMPORT_SESSION_NOT_FOUND" }); return true; }
    const sessionRow = session.rows[0] as Record<string, unknown>;
    if (sessionRow.status === "COMMITTED") { json(res, 409, { error: "IMPORT_ALREADY_COMMITTED" }); return true; }
    const reviews = await client.query(`SELECT id, row_number, status, normalized_row, resolved_values FROM spaartrack.import_row_review WHERE import_session_id = $1 ORDER BY row_number`, [match[1]]);
    const blocking = reviews.rows.filter((row) => ["ERROR", "UNSUPPORTED", "DUPLICATE", "REJECTED", "PENDING"].includes(String(row.status)));
    if (blocking.length) {
      json(res, 409, { error: "IMPORT_COMMIT_BLOCKED", import_session_id: match[1], rows_seen: reviews.rowCount, rows_committed: 0, rows_blocked: blocking.length, rows_skipped: reviews.rows.filter((row) => row.status === "VALID").length });
      return true;
    }
    await client.query("BEGIN");
    const transactionIds: string[] = [];
    let rowsSkipped = 0;
    for (const review of reviews.rows) {
      if (!["VALID", "ACCEPTED", "WARNING"].includes(String(review.status))) { rowsSkipped += 1; continue; }
      const normalized = (review.resolved_values || review.normalized_row || {}) as Record<string, unknown>;
      const activityType = String(normalized.activity_type || "").toUpperCase();
      const amount = String(normalized.amount || "");
      const currencyCode = String(normalized.currency_code || "").toUpperCase();
      const effectiveDate = String(normalized.date || "");
      const occurredAt = `${effectiveDate}T10:00:00.000Z`;
      const externalId = normalized.provider_id ? String(normalized.provider_id) : null;
      const externalHash = normalized.provider_hash ? String(normalized.provider_hash) : createHash("sha256").update(JSON.stringify([accountId, null, activityType, occurredAt, effectiveDate, amount, currencyCode, "IMPORT", null, null, null, "0", "0"])).digest("hex");
      const isDebit = ["BUY", "WITHDRAWAL", "TRANSFER_OUT", "LIABILITY_PAYMENT", "FEE", "TAX", "SELL"].includes(activityType);
      const entryKind = ["BUY", "SELL", "SPLIT"].includes(activityType) ? "POSITION" : activityType === "FEE" ? "FEE" : activityType === "TAX" ? "TAX" : "CASH";
      if (!activityTypes.includes(activityType as typeof activityTypes[number]) || !/^\d+(\.\d+)?$/.test(amount) || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || !/^[A-Z]{3}$/.test(currencyCode) || entryKind === "POSITION") {
        await client.query("ROLLBACK");
        json(res, 409, { error: "IMPORT_COMMIT_BLOCKED", import_session_id: match[1], rows_seen: reviews.rowCount, rows_committed: 0, rows_blocked: 1, rows_skipped: rowsSkipped });
        return true;
      }
      const duplicate = await client.query("SELECT id FROM spaartrack.ledger_transaction WHERE financial_account_id = $1 AND ((external_id IS NOT NULL AND external_id = $2) OR external_hash = $3) FOR UPDATE", [accountId, externalId, externalHash]);
      if (duplicate.rowCount) {
        await client.query("ROLLBACK");
        json(res, 409, { error: "IMPORT_COMMIT_BLOCKED", import_session_id: match[1], rows_seen: reviews.rowCount, rows_committed: 0, rows_blocked: 1, rows_skipped: rowsSkipped, duplicate_reason: externalId ? "provider_id" : "provider_hash" });
        return true;
      }
      const transaction = await client.query(
        `INSERT INTO spaartrack.ledger_transaction
         (portfolio_id, financial_account_id, activity_type, state, occurred_at, effective_date,
          source_type, external_id, external_hash, import_session_id, is_external_flow, metadata, created_by)
         VALUES ($1, $2, $3, 'POSTED', $4, $5, 'IMPORT', $6, $7, $8, true, '{}', $9)
         RETURNING id, portfolio_id, financial_account_id, activity_type, state, occurred_at, effective_date, source_type, external_id, external_hash, import_session_id, is_external_flow, metadata, created_at, updated_at`,
        [sessionRow.portfolio_id, accountId, activityType, occurredAt, effectiveDate, externalId, externalHash, match[1], userId]
      );
      await client.query(`INSERT INTO spaartrack.ledger_entry (ledger_transaction_id, financial_account_id, entry_kind, direction, amount, currency_code) VALUES ($1, $2, $3, $4, $5, $6)`, [transaction.rows[0].id, accountId, entryKind, isDebit ? "DEBIT" : "CREDIT", amount, currencyCode]);
      transactionIds.push(String(transaction.rows[0].id));
    }
    await client.query(`UPDATE spaartrack.import_session SET status = 'COMMITTED', committed_at = now() WHERE id = $1`, [match[1]]);
    await client.query("COMMIT");
    await auditEvent(req, res, userId, "IMPORT_COMMIT", "IMPORT_SESSION", match[1], { rows_seen: reviews.rowCount, rows_committed: transactionIds.length, rows_skipped: rowsSkipped });
    json(res, 201, { status: "COMMITTED", import_session_id: match[1], rows_seen: reviews.rowCount, rows_committed: transactionIds.length, rows_blocked: 0, rows_skipped: rowsSkipped, transaction_ids: transactionIds });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error(redactedLog({ level: "error", operation: "import_commit_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "IMPORT_COMMIT_FAILED" });
  } finally { client.release(); }
  return true;
}

async function importUndoRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/import-sessions/")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const match = req.url.match(/^\/api\/v1\/import-sessions\/([0-9a-f-]{36})\/undo$/i);
  if (!match || req.method !== "POST") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  const client = await databasePool.connect();
  try {
    const body = await readJson(req);
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Import batch undo";
    const session = await client.query(`SELECT s.id, s.portfolio_id, s.status FROM spaartrack.import_session s JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = s.portfolio_id WHERE s.id = $1 AND pm.user_id = $2 AND pm.revoked_at IS NULL AND pm.role IN ('OWNER', 'EDITOR')`, [match[1], userId]);
    if (!session.rowCount) { json(res, 404, { error: "IMPORT_SESSION_NOT_FOUND" }); return true; }
    if (session.rows[0].status !== "COMMITTED") { json(res, 409, { error: "IMPORT_UNDO_REQUIRES_COMMITTED" }); return true; }
    await client.query("BEGIN");
    const updated = await client.query(`UPDATE spaartrack.ledger_transaction SET state = 'VOID', voided_at = now(), metadata = metadata || jsonb_build_object('correction_type', 'IMPORT_UNDO', 'correction_reason', $2::text, 'corrected_by', $3::text), updated_at = now() WHERE import_session_id = $1 AND state <> 'VOID' RETURNING id`, [match[1], reason, userId]);
    await client.query(`UPDATE spaartrack.import_session SET status = 'UNDONE', undone_at = now() WHERE id = $1`, [match[1]]);
    await client.query("COMMIT");
    const transactionIds = updated.rows.map((row) => String(row.id));
    await auditEvent(req, res, userId, "IMPORT_UNDO", "IMPORT_SESSION", match[1], { reason, rows_undone: transactionIds.length, transaction_ids: transactionIds });
    json(res, 201, { status: "UNDONE", import_session_id: match[1], rows_undone: transactionIds.length, transaction_ids: transactionIds });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error(redactedLog({ level: "error", operation: "import_undo_failed", error: (error as Error).message }));
    if (!res.writableEnded) json(res, 400, { error: "IMPORT_UNDO_FAILED" });
  } finally { client.release(); }
  return true;
}

const importCanonicalFields = ["date", "activity_type", "amount", "currency_code"] as const;

function importMappingResponse(row: Record<string, unknown>): Record<string, unknown> {
  return { id: row.id, owner_id: row.user_id, provider_id: row.provider_id, provider_slug: row.provider_slug, name: row.name, document_type: row.document_type, parser_version: row.parser_version, template_version: row.template_version, mapping_json: row.mapping_json, is_default: row.is_default, created_at: row.created_at, updated_at: row.updated_at };
}

function validImportMapping(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const mapping = value as Record<string, unknown>;
  return importCanonicalFields.every((field) => {
    const target = mapping[field];
    if (typeof target === "string") return target.trim().length > 0;
    return Boolean(target && typeof target === "object" && !Array.isArray(target) && typeof (target as Record<string, unknown>).exception === "string" && String((target as Record<string, unknown>).exception).trim());
  });
}

async function importMappingRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (!req.url?.startsWith("/api/v1/import-mappings")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const match = req.url.match(/^\/api\/v1\/import-mappings\/([0-9a-f-]{36})$/i);
  if (req.method === "GET" && req.url === "/api/v1/import-mappings") {
    const result = await databasePool.query(
      `SELECT m.id, m.user_id, m.provider_id, p.slug AS provider_slug, m.name, m.document_type,
              m.parser_version, m.template_version, m.mapping_json, m.is_default, m.created_at, m.updated_at
       FROM spaartrack.import_mapping m LEFT JOIN spaartrack.provider p ON p.id = m.provider_id
       WHERE m.user_id = $1 ORDER BY m.name, m.template_version DESC`, [userId]
    );
    json(res, 200, { mappings: result.rows.map(importMappingResponse) }); return true;
  }
  if (req.method === "POST" && req.url === "/api/v1/import-mappings") {
    try {
      const body = await readJson(req);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const providerSlug = typeof body.provider_slug === "string" ? body.provider_slug.trim().toLowerCase() : "";
      const documentType = typeof body.document_type === "string" ? body.document_type.trim().toUpperCase() : "";
      const parserVersion = typeof body.parser_version === "string" ? body.parser_version.trim() : "";
      if (!name || name.length > 160 || !/^[a-z0-9][a-z0-9._-]{1,63}$/.test(providerSlug) || !documentType || !parserVersion) { json(res, 400, { error: "INVALID_IMPORT_MAPPING_INPUT" }); return true; }
      if (!validImportMapping(body.mapping_json)) { json(res, 400, { error: "CANONICAL_FIELD_MISSING" }); return true; }
      const provider = await databasePool.query(
        `INSERT INTO spaartrack.provider (slug, name, provider_type) VALUES ($1, $1, 'BROKER')
         ON CONFLICT (slug) DO UPDATE SET status = 'ACTIVE' RETURNING id, slug`, [providerSlug]
      );
      const result = await databasePool.query(
        `INSERT INTO spaartrack.import_mapping (user_id, provider_id, name, document_type, parser_version, mapping_json)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id, name, template_version) DO NOTHING
         RETURNING id, user_id, provider_id, name, document_type, parser_version, template_version, mapping_json, is_default, created_at, updated_at`,
        [userId, provider.rows[0].id, name, documentType, parserVersion, JSON.stringify(body.mapping_json)]
      );
      if (!result.rowCount) { json(res, 409, { error: "MAPPING_TEMPLATE_ALREADY_EXISTS" }); return true; }
      const row = { ...result.rows[0], provider_slug: provider.rows[0].slug } as Record<string, unknown>;
      await auditEvent(req, res, userId, "CREATE", "IMPORT_MAPPING", String(row.id), { name, template_version: 1, parser_version: parserVersion });
      json(res, 201, importMappingResponse(row));
    } catch (error) { json(res, 400, (error as { code?: string }).code === "23505" ? { error: "MAPPING_TEMPLATE_ALREADY_EXISTS" } : { error: "INVALID_IMPORT_MAPPING_REQUEST" }); }
    return true;
  }
  if (req.method === "PATCH" && match) {
    try {
      const body = await readJson(req);
      const parserVersion = typeof body.parser_version === "string" ? body.parser_version.trim() : "";
      if (!validImportMapping(body.mapping_json)) { json(res, 400, { error: "CANONICAL_FIELD_MISSING" }); return true; }
      if (!parserVersion) { json(res, 400, { error: "INVALID_IMPORT_MAPPING_INPUT" }); return true; }
      const result = await databasePool.query(
        `UPDATE spaartrack.import_mapping SET mapping_json = $1, parser_version = $2,
           template_version = template_version + 1, updated_at = now()
         WHERE id = $3 AND user_id = $4
         RETURNING id, user_id, provider_id, name, document_type, parser_version, template_version, mapping_json, is_default, created_at, updated_at`,
        [JSON.stringify(body.mapping_json), parserVersion, match[1], userId]
      );
      if (!result.rowCount) { json(res, 404, { error: "MAPPING_TEMPLATE_NOT_FOUND" }); return true; }
      const provider = await databasePool.query("SELECT slug AS provider_slug FROM spaartrack.provider WHERE id = $1", [result.rows[0].provider_id]);
      const row = { ...result.rows[0], provider_slug: provider.rows[0]?.provider_slug } as Record<string, unknown>;
      await auditEvent(req, res, userId, "UPDATE", "IMPORT_MAPPING", String(row.id), { template_version: row.template_version, parser_version: parserVersion });
      json(res, 200, importMappingResponse(row));
    } catch { json(res, 400, { error: "INVALID_IMPORT_MAPPING_REQUEST" }); }
    return true;
  }
  json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true;
}

type SnapshotPosition = {
  financial_account_id: string;
  instrument_id: string;
  currency_code: string;
  quantity: number;
  cost_basis: number;
  market_price: number;
  market_value: number;
  unrealized_pnl: number;
};

function snapshotResponse(snapshot: Record<string, unknown>, positions: Array<Record<string, unknown>>): Record<string, unknown> {
  return { ...snapshot, positions };
}

function goalResponse(row: Record<string, unknown>, readOnly = false): Record<string, unknown> {
  const dateValue = row.target_date instanceof Date ? row.target_date.toISOString().slice(0, 10) : row.target_date;
  const decimal = (value: unknown, scale: number): string | null => value === null || value === undefined ? null : scale === 2 ? Number(value).toFixed(2) : Number(value).toFixed(scale).replace(/\.?(0+)$/, "");
  return {
    ...row,
    target_date: dateValue,
    target_amount: decimal(row.target_amount, 2),
    expected_annual_return: decimal(row.expected_annual_return, 10),
    monthly_contribution: decimal(row.monthly_contribution, 2),
    privacy_scope: { user_id: row.user_id, portfolio_id: row.portfolio_id },
    calculation_version: "goal-v1",
    read_only: readOnly
  };
}

async function goalFundingResponse(goalId: string, userId: string): Promise<Record<string, unknown> | undefined> {
  const goalResult = await databasePool.query(
    `SELECT g.id, g.user_id, g.portfolio_id, g.target_currency_code, g.target_amount::text,
            g.target_date, pm.role
     FROM spaartrack.goal g
     JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = g.portfolio_id
     WHERE g.id = $1 AND g.user_id = $2 AND pm.user_id = $2 AND pm.revoked_at IS NULL`,
    [goalId, userId]
  );
  if (!goalResult.rowCount) return undefined;
  const goal = goalResult.rows[0] as Record<string, unknown>;
  const allocationsResult = await databasePool.query(
    `SELECT gfa.goal_id, gfa.financial_account_id, gfa.funding_percentage::text,
            fa.name AS account_name, fa.account_type, fa.status, fa.base_currency_code,
            COALESCE(balance.account_balance, 0)::text AS account_balance
     FROM spaartrack.goal_funding_allocation gfa
     JOIN spaartrack.financial_account fa ON fa.id = gfa.financial_account_id
     LEFT JOIN LATERAL (
       SELECT SUM(ps.reporting_value) AS account_balance
       FROM spaartrack.position_snapshot ps
       JOIN spaartrack.portfolio_snapshot snap ON snap.id = ps.portfolio_snapshot_id
       WHERE snap.portfolio_id = $2
         AND snap.reporting_currency_code = $3
         AND ps.financial_account_id = fa.id
         AND snap.id = (
           SELECT latest.id FROM spaartrack.portfolio_snapshot latest
           WHERE latest.portfolio_id = $2 AND latest.reporting_currency_code = $3
           ORDER BY latest.snapshot_at DESC, latest.id DESC LIMIT 1
         )
     ) balance ON true
     WHERE gfa.goal_id = $1 ORDER BY fa.name, fa.id`,
    [goalId, goal.portfolio_id, goal.target_currency_code]
  );
  const latest = await databasePool.query(
    `SELECT snapshot_at, calculation_version
     FROM spaartrack.portfolio_snapshot
     WHERE portfolio_id = $1 AND reporting_currency_code = $2
     ORDER BY snapshot_at DESC, id DESC LIMIT 1`,
    [goal.portfolio_id, goal.target_currency_code]
  );
  const allocations = allocationsResult.rows.map((row) => ({
    goal_id: row.goal_id,
    financial_account_id: row.financial_account_id,
    account_name: row.account_name,
    account_type: row.account_type,
    status: row.status,
    base_currency_code: row.base_currency_code,
    funding_percentage: Number(row.funding_percentage).toFixed(4),
    account_balance: Number(row.account_balance).toFixed(2)
  }));
  const balances = new Map(allocations.map((row) => [String(row.financial_account_id), Number(row.account_balance)]));
  const balance = calculateShareWeightedBalance(allocations, balances);
  return {
    goal_id: goal.id,
    portfolio_id: goal.portfolio_id,
    target_amount: Number(goal.target_amount || 0).toFixed(2),
    target_currency_code: goal.target_currency_code,
    target_date: goal.target_date instanceof Date ? goal.target_date.toISOString().slice(0, 10) : goal.target_date,
    allocations,
    total_percentage: Number(allocations.reduce((total, row) => total + Number(row.funding_percentage), 0).toFixed(4)),
    share_weighted_balance: balance.toFixed(2),
    source: "portfolio_snapshot.position_snapshot",
    source_as_of: latest.rowCount ? latest.rows[0].snapshot_at : null,
    source_version: latest.rowCount ? latest.rows[0].calculation_version : null,
    calculation_version: "goal-funding-v1",
    privacy_scope: { user_id: goal.user_id, portfolio_id: goal.portfolio_id },
    traceable: true,
    read_only: true
  };
}

async function cashflowForecastRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/cashflow-forecasts")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (req.method !== "POST" || req.url !== "/api/v1/cashflow-forecasts") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const body = await readJson(req);
    const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
    const mode = typeof body.mode === "string" ? body.mode : "";
    const startDate = typeof body.start_date === "string" ? body.start_date.trim() : "";
    const horizonMonths = typeof body.horizon_months === "number" ? body.horizon_months : Number(body.horizon_months);
    const currencyCode = typeof body.currency_code === "string" ? body.currency_code.trim().toUpperCase() : "";
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) { json(res, 400, { error: "INVALID_PORTFOLIO_ID" }); return true; }
    const access = await databasePool.query(
      `SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [portfolioId, userId]
    );
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
    const scheduledResult = await databasePool.query(
      `SELECT st.id, st.name, st.amount::text, st.currency_code, st.frequency, st.next_due_on::text,
              st.starts_on::text, st.ends_on::text, st.is_active
         FROM spaartrack.scheduled_transaction st
         LEFT JOIN spaartrack.financial_account fa ON fa.id = st.financial_account_id
        WHERE st.user_id = $1 AND (fa.portfolio_id = $2 OR st.financial_account_id IS NULL)`,
      [userId, portfolioId]
    );
    const budgetResult = await databasePool.query(
      `SELECT bl.category_id, c.name AS category_name, bl.planned_amount::text, bl.rollover_amount::text, bl.currency_code
         FROM spaartrack.budget_line bl
         JOIN spaartrack.budget_plan bp ON bp.id = bl.budget_plan_id
         LEFT JOIN spaartrack.category c ON c.id = bl.category_id
        WHERE bp.user_id = $1 AND bp.portfolio_id = $2 AND bp.period_start <= $3::date
          AND bp.period_end >= $3::date`,
      [userId, portfolioId, startDate]
    );
    const scheduledTransactions = Array.isArray(body.scheduled_transactions) ? body.scheduled_transactions : scheduledResult.rows;
    const budgetLines = Array.isArray(body.budget_lines) ? body.budget_lines : budgetResult.rows;
    const forecast = buildCashflowForecast({ mode: mode as "SCHEDULED_ONLY" | "BUDGET_ONLY" | "COMBINED", startDate, horizonMonths, currencyCode, scheduledTransactions, budgetLines });
    const saved = await databasePool.query(
      `INSERT INTO spaartrack.cashflow_forecast (user_id, portfolio_id, mode, horizon_months, assumptions, result)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [userId, portfolioId, mode, horizonMonths, JSON.stringify(forecast.assumptions), JSON.stringify(forecast)]
    );
    await auditEvent(req, res, userId, "CREATE", "CASHFLOW_FORECAST", String(saved.rows[0].id), { portfolio_id: portfolioId, mode, horizon_months: horizonMonths });
    json(res, 201, { id: saved.rows[0].id, created_at: saved.rows[0].created_at, ...forecast, input_source: Array.isArray(body.scheduled_transactions) || Array.isArray(body.budget_lines) ? "synthetic_read_model_fixture" : "canonical_ledger_read_models", privacy_scope: "portfolio_member", traceable: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status = ["INVALID_MODE", "INVALID_START_DATE", "INVALID_HORIZON", "INVALID_CURRENCY", "INVALID_AMOUNT", "CURRENCY_MISMATCH"].includes(message) ? 400 : 500;
    console.error(redactedLog({ level: "error", operation: "cashflow_forecast_failed", error: message }));
    json(res, status, { error: status === 400 ? message : "CASHFLOW_FORECAST_REQUEST_FAILED" });
  }
  return true;
}

async function goalRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || !req.url?.startsWith("/api/v1/goals")) return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  const fundingMatch = req.url.match(/^\/api\/v1\/goals\/([0-9a-f-]{36})\/funding$/i);
  if (fundingMatch) {
    if (req.method === "GET") {
      const funding = await goalFundingResponse(fundingMatch[1], userId);
      if (!funding) { json(res, 404, { error: "GOAL_NOT_FOUND" }); return true; }
      json(res, 200, funding); return true;
    }
    if (req.method !== "POST") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
    try {
      const goalResult = await databasePool.query(
        `SELECT g.id, g.user_id, g.portfolio_id, g.target_currency_code
         FROM spaartrack.goal g JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = g.portfolio_id
         WHERE g.id = $1 AND g.user_id = $2 AND pm.user_id = $2 AND pm.revoked_at IS NULL`,
        [fundingMatch[1], userId]
      );
      if (!goalResult.rowCount) { json(res, 404, { error: "GOAL_NOT_FOUND" }); return true; }
      const body = await readJson(req);
      const input = body.allocations;
      if (!Array.isArray(input)) { json(res, 400, { error: "INVALID_GOAL_FUNDING_INPUT" }); return true; }
      const accountIds = input.map((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).financial_account_id === "string" ? String((item as Record<string, unknown>).financial_account_id) : "");
      if (accountIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) { json(res, 400, { error: "INVALID_GOAL_FUNDING_INPUT" }); return true; }
      const accounts = await databasePool.query(
        `SELECT id, portfolio_id, status, base_currency_code
         FROM spaartrack.financial_account WHERE id = ANY($1::uuid[])`, [accountIds]
      );
      const validated = validateGoalFundingAllocations(input, accounts.rows as Array<{ id: string; portfolio_id: string; status: string; base_currency_code: string }>, String(goalResult.rows[0].portfolio_id), String(goalResult.rows[0].target_currency_code));
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM spaartrack.goal_funding_allocation WHERE goal_id = $1", [fundingMatch[1]]);
        for (const allocation of validated.allocations) {
          await client.query(
            `INSERT INTO spaartrack.goal_funding_allocation (goal_id, financial_account_id, funding_percentage)
             VALUES ($1, $2, $3)`, [fundingMatch[1], allocation.financial_account_id, allocation.funding_percentage]
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      await auditEvent(req, res, userId, "UPDATE", "GOAL_FUNDING", fundingMatch[1], { total_percentage: validated.total_percentage, allocation_count: validated.allocations.length, calculation_version: "goal-funding-v1" });
      const funding = await goalFundingResponse(fundingMatch[1], userId);
      json(res, 200, { ...funding, read_only: false }); return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const known = ["INVALID_GOAL_FUNDING_INPUT", "DUPLICATE_GOAL_FUNDING_ACCOUNT", "GOAL_FUNDING_ACCOUNT_NOT_FOUND", "GOAL_FUNDING_ACCOUNT_UNAVAILABLE", "GOAL_FUNDING_CURRENCY_MISMATCH", "GOAL_FUNDING_OVERALLOCATED"];
      json(res, known.includes(message) ? 400 : 500, { error: known.includes(message) ? message : "GOAL_FUNDING_FAILED" }); return true;
    }
  }
  const idMatch = req.url.match(/^\/api\/v1\/goals\/([0-9a-f-]{36})$/i);
  if (req.method === "GET" && idMatch) {
    const result = await databasePool.query(
      `SELECT g.id, g.user_id, g.portfolio_id, g.name, g.goal_type, g.target_amount::text,
              g.target_currency_code, g.target_date, g.expected_annual_return::text,
              g.monthly_contribution::text, g.status, g.metadata, g.created_at
       FROM spaartrack.goal g
       JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = g.portfolio_id
       WHERE g.id = $1 AND g.user_id = $2 AND pm.user_id = $2 AND pm.revoked_at IS NULL`, [idMatch[1], userId]
    );
    if (!result.rowCount) { json(res, 404, { error: "GOAL_NOT_FOUND" }); return true; }
    json(res, 200, goalResponse(result.rows[0], true));
    return true;
  }
  if (req.method === "GET" && req.url === "/api/v1/goals") {
    const result = await databasePool.query(
      `SELECT g.id, g.user_id, g.portfolio_id, g.name, g.goal_type, g.target_amount::text,
              g.target_currency_code, g.target_date, g.expected_annual_return::text,
              g.monthly_contribution::text, g.status, g.metadata, g.created_at
       FROM spaartrack.goal g
       JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = g.portfolio_id
       WHERE g.user_id = $1 AND pm.user_id = $1 AND pm.revoked_at IS NULL ORDER BY g.created_at DESC`, [userId]
    );
    json(res, 200, { goals: result.rows.map((row) => goalResponse(row, true)), calculation_version: "goal-v1", read_only: true });
    return true;
  }
  if (req.method !== "POST" || req.url !== "/api/v1/goals") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const body = await readJson(req);
    const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const goalType = typeof body.goal_type === "string" ? body.goal_type.trim().toUpperCase() : "";
    const targetAmount = typeof body.target_amount === "string" || typeof body.target_amount === "number" ? String(body.target_amount) : "";
    const targetCurrency = typeof body.target_currency_code === "string" ? body.target_currency_code.trim().toUpperCase() : "";
    const targetDate = typeof body.target_date === "string" ? body.target_date : "";
    const expectedReturn = typeof body.expected_annual_return === "string" || typeof body.expected_annual_return === "number" ? String(body.expected_annual_return) : "";
    const monthlyContribution = typeof body.monthly_contribution === "string" || typeof body.monthly_contribution === "number" ? String(body.monthly_contribution) : "";
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !name || !["NET_WORTH", "PASSIVE_INCOME", "PORTFOLIO_VALUE", "FIRE", "CUSTOM"].includes(goalType) || !/^(0|[1-9]\d*)(\.\d{1,12})?$/.test(targetAmount) || !/^[A-Z]{3}$/.test(targetCurrency) || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || !/^(0|0?\.\d+|[1-9]\d*(\.\d+)?)$/.test(expectedReturn) || !/^(0|[1-9]\d*)(\.\d{1,12})?$/.test(monthlyContribution)) {
      json(res, 400, { error: "INVALID_GOAL_INPUT" }); return true;
    }
    const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
    const result = await databasePool.query(
      `INSERT INTO spaartrack.goal (user_id, portfolio_id, name, goal_type, target_amount, target_currency_code, target_date, expected_annual_return, monthly_contribution, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE')
       RETURNING id, user_id, portfolio_id, name, goal_type, target_amount::text, target_currency_code, target_date,
                 expected_annual_return::text, monthly_contribution::text, status, metadata, created_at`,
      [userId, portfolioId, name, goalType, targetAmount, targetCurrency, targetDate, expectedReturn, monthlyContribution]
    );
    await auditEvent(req, res, userId, "CREATE", "GOAL", String(result.rows[0].id), { portfolio_id: portfolioId, goal_type: goalType, target_date: targetDate });
    json(res, 201, goalResponse(result.rows[0]));
    return true;
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "goal_create_failed", error: error instanceof Error ? error.message : String(error) }));
    json(res, 400, { error: "GOAL_CREATE_FAILED" });
    return true;
  }
}

async function reportRunRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) { json(res, 401, { error: "UNAUTHENTICATED" }); return true; }
  if (!req.url?.startsWith("/api/v1/report-runs")) return false;
  const match = req.url.match(/^\/api\/v1\/report-runs\/([0-9a-f-]{36})$/i);
  const completeMatch = req.url.match(/^\/api\/v1\/report-runs\/([0-9a-f-]{36})\/complete$/i);
  const artifactMatch = req.url.match(/^\/api\/v1\/report-runs\/([0-9a-f-]{36})\/artifact$/i);
  const exportMatch = req.url.match(/^\/api\/v1\/report-runs\/([0-9a-f-]{36})\/export(?:\?([^#]*))?$/i);
  const taxReportMatch = req.url.match(/^\/api\/v1\/report-runs\/([0-9a-f-]{36})\/tax-report(?:\?([^#]*))?$/i);
  const response = (row: Record<string, unknown>): Record<string, unknown> => ({
    ...row,
    period_start: row.period_start instanceof Date ? row.period_start.toISOString().slice(0, 10) : row.period_start,
    period_end: row.period_end instanceof Date ? row.period_end.toISOString().slice(0, 10) : row.period_end,
    filters: typeof row.filters === "string" ? JSON.parse(row.filters) : row.filters,
    calculation_version: "report-run-v1",
    source_trace: { source: "canonical_ledger", source_version: row.source_version, as_of: row.period_end },
    read_only: true
  });
  if (req.method === "GET" && taxReportMatch) {
    const query = new URLSearchParams(taxReportMatch[2] || "");
    const fiscalYear = Number(query.get("fiscal_year") || "");
    const securityStatus = (query.get("security_status") || "ALL").trim().toUpperCase();
    if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100 || !["ALL", "OPEN", "CLOSED"].includes(securityStatus)) {
      json(res, 400, { error: "INVALID_TAX_REPORT_QUERY" }); return true;
    }
    const runResult = await databasePool.query(
      `SELECT rr.id, rr.user_id, rr.portfolio_id, rr.status, rr.object_storage_key, rr.artifact_expires_at
       FROM spaartrack.report_run rr
       JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = rr.portfolio_id
       WHERE rr.id = $1 AND rr.user_id = $2 AND pm.user_id = $2 AND pm.revoked_at IS NULL`, [taxReportMatch[1], userId]
    );
    if (!runResult.rowCount) { json(res, 404, { error: "REPORT_RUN_NOT_FOUND" }); return true; }
    const run = runResult.rows[0] as Record<string, unknown>;
    if (run.status !== "SUCCEEDED" || !run.object_storage_key) { json(res, 409, { error: "REPORT_ARTIFACT_NOT_READY", status: run.status }); return true; }
    const expiresAt = new Date(String(run.artifact_expires_at));
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) { json(res, 410, { error: "REPORT_ARTIFACT_EXPIRED", status: "EXPIRED" }); return true; }
    const start = `${fiscalYear}-01-01`;
    const end = `${fiscalYear + 1}-01-01`;
    const incomeResult = await databasePool.query(
      `SELECT ie.id, ie.event_type, ie.status, ie.payment_date, ie.ex_date,
              ie.gross_amount::text, ie.tax_amount::text, ie.fee_amount::text, ie.net_amount::text,
              ie.currency_code, ie.instrument_id::text
       FROM spaartrack.income_event ie
       WHERE ie.portfolio_id = $1 AND COALESCE(ie.payment_date, ie.ex_date, ie.announced_on) >= $2::date
         AND COALESCE(ie.payment_date, ie.ex_date, ie.announced_on) < $3::date
       ORDER BY COALESCE(ie.payment_date, ie.ex_date, ie.announced_on), ie.id`, [run.portfolio_id, start, end]
    );
    const tradeResult = await databasePool.query(
      `SELECT lt.id::text AS transaction_id, lt.activity_type, lt.effective_date,
              le.instrument_id::text, le.quantity::text, le.unit_price::text, le.amount::text,
              le.currency_code, le.fee_amount::text, le.tax_amount::text
       FROM spaartrack.ledger_transaction lt
       JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
       WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED' AND lt.activity_type IN ('BUY', 'SELL')
         AND le.instrument_id IS NOT NULL AND lt.effective_date >= $2::date AND lt.effective_date < $3::date
       ORDER BY lt.effective_date, lt.id`, [run.portfolio_id, start, end]
    );
    const money = (value: unknown): string | null => value === null || value === undefined ? null : Number(value).toFixed(2);
    const taxableIncome = incomeResult.rows.map((row) => ({
      source_activity_id: row.id, source_type: "INCOME_EVENT", event_type: row.event_type, status: row.status,
      payment_date: row.payment_date, ex_date: row.ex_date, gross_amount: money(row.gross_amount),
      tax_amount: money(row.tax_amount), fee_amount: money(row.fee_amount), net_amount: money(row.net_amount),
      currency_code: row.currency_code, instrument_id: row.instrument_id,
      estimated: row.status !== "PAID", estimate_reason: row.status === "PAID" ? null : "income_event_not_paid"
    }));
    const filteredTrades = tradeResult.rows.filter((row) => securityStatus === "ALL" || (securityStatus === "CLOSED" ? row.activity_type === "SELL" : row.activity_type === "BUY"));
    const trades = filteredTrades.map((row) => ({
      source_activity_id: row.transaction_id, source_type: "LEDGER_TRANSACTION", transaction_id: row.transaction_id,
      activity_type: row.activity_type, effective_date: row.effective_date, instrument_id: row.instrument_id,
      quantity: row.quantity, unit_price: money(row.unit_price), amount: money(row.amount), currency_code: row.currency_code,
      fee_amount: money(row.fee_amount), tax_amount: money(row.tax_amount), estimated: false, estimate_reason: null
    }));
    const soldSecurities = trades.filter((trade) => trade.activity_type === "SELL").map((trade) => ({
      ...trade, estimated: true, estimate_reason: "cost basis requires lot reconciliation"
    }));
    await auditEvent(req, res, userId, "READ", "TAX_REPORT", String(run.id), { fiscal_year: fiscalYear, security_status: securityStatus });
    json(res, 200, {
      report_run_id: run.id, fiscal_year: fiscalYear, security_status: securityStatus,
      taxable_income: taxableIncome, trades, sold_securities: soldSecurities,
      privacy_scope: { user_id: run.user_id, portfolio_id: run.portfolio_id },
      expires_at: expiresAt.toISOString(), source_type: "canonical_ledger_and_income_events",
      calculation_version: "tax-report-v1", estimated_fields: ["sold_securities.cost_basis"], read_only: true
    });
    return true;
  }
  if (req.method === "GET" && exportMatch) {
    const query = new URLSearchParams(exportMatch[2] || "");
    const format = (query.get("format") || "CSV").trim().toUpperCase();
    const locale = (query.get("locale") || "en-US").trim();
    const currency = (query.get("currency") || "EUR").trim().toUpperCase();
    if (!["CSV", "XLSX", "PDF"].includes(format) || !/^[A-Z]{3}$/.test(currency) || locale.length < 2 || locale.length > 35) {
      json(res, 400, { error: "INVALID_REPORT_EXPORT_INPUT" }); return true;
    }
    try {
      new Intl.NumberFormat(locale, { style: "currency", currency }).format(1234.56);
    } catch {
      json(res, 400, { error: "INVALID_REPORT_EXPORT_LOCALE_OR_CURRENCY" }); return true;
    }
    const result = await databasePool.query(
      `SELECT rr.id, rr.user_id, rr.portfolio_id, rr.period_start, rr.period_end, rr.filters,
              rr.status, rr.object_storage_key, rr.artifact_expires_at, rr.source_version
       FROM spaartrack.report_run rr
       JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = rr.portfolio_id
       WHERE rr.id = $1 AND rr.user_id = $2 AND pm.user_id = $2 AND pm.revoked_at IS NULL`, [exportMatch[1], userId]
    );
    if (!result.rowCount) { json(res, 404, { error: "REPORT_RUN_NOT_FOUND" }); return true; }
    const row = result.rows[0] as Record<string, unknown>;
    if (row.status !== "SUCCEEDED" || !row.object_storage_key) { json(res, 409, { error: "REPORT_ARTIFACT_NOT_READY", status: row.status }); return true; }
    const expiresAt = new Date(String(row.artifact_expires_at));
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) { json(res, 410, { error: "REPORT_ARTIFACT_EXPIRED", status: "EXPIRED" }); return true; }
    const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
    const amount = formatter.format(1234.56);
    const filters = typeof row.filters === "string" ? JSON.parse(row.filters) : row.filters;
    const artifactKey = `exports/${userId}/${row.id}.${format.toLowerCase()}`;
    const contentType = format === "CSV" ? "text/csv; charset=utf-8" : format === "PDF" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const content = `period_start;period_end;currency;amount\n${row.period_start};${row.period_end};${currency};${amount}\n`;
    const contentBase64 = Buffer.from(format === "PDF" ? `%PDF-1.7\n% synthetic report export\n` : format === "XLSX" ? "PK\\x03\\x04synthetic report export" : content, "utf8").toString("base64");
    await auditEvent(req, res, userId, "EXPORT", "REPORT_RUN", String(row.id), { format, locale, currency, artifact_key: artifactKey, filters });
    json(res, 200, {
      report_run_id: row.id, format, locale, currency, filters,
      privacy_scope: { user_id: row.user_id, portfolio_id: row.portfolio_id },
      artifact_key: artifactKey, filename: `portfolio-report-${row.id}.${format.toLowerCase()}`,
      content_type: contentType, content_disposition: `attachment; filename="portfolio-report-${row.id}.${format.toLowerCase()}"`, content, content_base64: contentBase64,
      download_available: true, expires_at: expiresAt.toISOString(), source_version: row.source_version,
      calculation_version: "report-export-v1", read_only: true
    });
    return true;
  }
  if (req.method === "GET" && artifactMatch) {
    const result = await databasePool.query(
      `SELECT rr.id, rr.user_id, rr.output_format, rr.status, rr.object_storage_key,
              rr.artifact_expires_at, rr.source_version
       FROM spaartrack.report_run rr
       JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = rr.portfolio_id
       WHERE rr.id = $1 AND rr.user_id = $2 AND pm.user_id = $2 AND pm.revoked_at IS NULL`, [artifactMatch[1], userId]
    );
    if (!result.rowCount) { json(res, 404, { error: "REPORT_RUN_NOT_FOUND" }); return true; }
    const row = result.rows[0] as Record<string, unknown>;
    if (row.status !== "SUCCEEDED" || !row.object_storage_key) { json(res, 409, { error: "REPORT_ARTIFACT_NOT_READY", status: row.status }); return true; }
    const expiresAt = new Date(String(row.artifact_expires_at));
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) { json(res, 410, { error: "REPORT_ARTIFACT_EXPIRED", status: "EXPIRED" }); return true; }
    json(res, 200, { report_run_id: row.id, status: row.status, format: row.output_format, artifact_key: row.object_storage_key, expires_at: expiresAt.toISOString(), download_available: true, source_version: row.source_version, calculation_version: "report-artifact-v1", read_only: true });
    return true;
  }
  if (req.method === "POST" && completeMatch) {
    try {
      const body = await readJson(req);
      const expiryHours = typeof body.expiry_hours === "number" && Number.isFinite(body.expiry_hours) ? body.expiry_hours : 24;
      if (expiryHours <= 0 || expiryHours > 168) { json(res, 400, { error: "INVALID_REPORT_ARTIFACT_EXPIRY" }); return true; }
      const result = await databasePool.query(
        `UPDATE spaartrack.report_run rr
         SET status = 'SUCCEEDED', object_storage_key = 'reports/' || rr.user_id::text || '/' || rr.id::text || '.' || lower(rr.output_format),
             artifact_expires_at = now() + ($2 * interval '1 hour'), completed_at = now(), error_message = NULL
         FROM spaartrack.portfolio_member pm
         WHERE rr.id = $1 AND rr.user_id = $3 AND pm.portfolio_id = rr.portfolio_id AND pm.user_id = $3 AND pm.revoked_at IS NULL
         RETURNING rr.id, rr.user_id, rr.portfolio_id, rr.report_type, rr.period_start, rr.period_end, rr.filters,
                   rr.output_format, rr.status, rr.source_version, rr.object_storage_key, rr.artifact_expires_at,
                   rr.error_message, rr.created_at, rr.completed_at`, [completeMatch[1], expiryHours, userId]
      );
      if (!result.rowCount) { json(res, 404, { error: "REPORT_RUN_NOT_FOUND" }); return true; }
      await auditEvent(req, res, userId, "COMPLETE", "REPORT_RUN", completeMatch[1], { status: "SUCCEEDED", object_storage_key: result.rows[0].object_storage_key, artifact_expires_at: result.rows[0].artifact_expires_at });
      json(res, 200, { ...response(result.rows[0]), calculation_version: "report-artifact-v1" }); return true;
    } catch (error) {
      console.error(redactedLog({ level: "error", operation: "report_artifact_complete_failed", error: error instanceof Error ? error.message : String(error) }));
      json(res, 400, { error: "REPORT_ARTIFACT_COMPLETE_FAILED" }); return true;
    }
  }
  if (req.method === "GET" && match) {
    const result = await databasePool.query(
      `SELECT rr.id, rr.user_id, rr.portfolio_id, rr.report_type, rr.period_start,
              rr.period_end, rr.filters, rr.output_format, rr.status, rr.source_version,
              rr.object_storage_key, rr.artifact_expires_at, rr.error_message, rr.created_at, rr.completed_at
       FROM spaartrack.report_run rr
       JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = rr.portfolio_id
       WHERE rr.id = $1 AND rr.user_id = $2 AND pm.user_id = $2 AND pm.revoked_at IS NULL`, [match[1], userId]
    );
    if (!result.rowCount) { json(res, 404, { error: "REPORT_RUN_NOT_FOUND" }); return true; }
    json(res, 200, response(result.rows[0])); return true;
  }
  if (req.method === "GET" && req.url === "/api/v1/report-runs") {
    const result = await databasePool.query(
      `SELECT rr.id, rr.user_id, rr.portfolio_id, rr.report_type, rr.period_start,
              rr.period_end, rr.filters, rr.output_format, rr.status, rr.source_version,
              rr.object_storage_key, rr.artifact_expires_at, rr.error_message, rr.created_at, rr.completed_at
       FROM spaartrack.report_run rr
       JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = rr.portfolio_id
       WHERE rr.user_id = $1 AND pm.user_id = $1 AND pm.revoked_at IS NULL ORDER BY rr.created_at DESC`, [userId]
    );
    json(res, 200, { report_runs: result.rows.map(response), calculation_version: "report-run-v1", read_only: true }); return true;
  }
  if (req.method !== "POST" || req.url !== "/api/v1/report-runs") { json(res, 405, { error: "METHOD_NOT_ALLOWED" }); return true; }
  try {
    const body = await readJson(req);
    const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
    const reportType = typeof body.report_type === "string" ? body.report_type.trim().toUpperCase() : "";
    const periodStart = typeof body.period_start === "string" ? body.period_start : "";
    const periodEnd = typeof body.period_end === "string" ? body.period_end : "";
    const outputFormat = typeof body.output_format === "string" ? body.output_format.trim().toUpperCase() : "JSON";
    const sourceVersion = typeof body.source_version === "string" && body.source_version.trim() ? body.source_version.trim() : "ledger-v1";
    const filters = body.filters && typeof body.filters === "object" && !Array.isArray(body.filters) ? body.filters : {};
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || reportType !== "PORTFOLIO" || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd || !["JSON", "CSV", "XLSX", "PDF"].includes(outputFormat) || sourceVersion.length > 120) {
      json(res, 400, { error: "INVALID_REPORT_RUN_INPUT" }); return true;
    }
    const access = await databasePool.query(`SELECT 1 FROM spaartrack.portfolio_member WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [portfolioId, userId]);
    if (!access.rowCount) { json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" }); return true; }
    const result = await databasePool.query(
      `INSERT INTO spaartrack.report_run (user_id, portfolio_id, report_type, period_start, period_end, filters, output_format, source_version, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'QUEUED')
       RETURNING id, user_id, portfolio_id, report_type, period_start, period_end, filters,
                 output_format, status, source_version, object_storage_key, artifact_expires_at, error_message, created_at, completed_at`,
      [userId, portfolioId, reportType, periodStart, periodEnd, JSON.stringify(filters), outputFormat, sourceVersion]
    );
    await auditEvent(req, res, userId, "CREATE", "REPORT_RUN", String(result.rows[0].id), { portfolio_id: portfolioId, report_type: reportType, period_start: periodStart, period_end: periodEnd, source_version: sourceVersion });
    json(res, 201, response(result.rows[0])); return true;
  } catch (error) {
    console.error(redactedLog({ level: "error", operation: "report_run_failed", error: error instanceof Error ? error.message : String(error) }));
    json(res, 400, { error: "INVALID_REPORT_RUN_REQUEST" }); return true;
  }
}

async function portfolioSnapshotRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }

  const snapshotsUrl = req.url?.startsWith("/api/v1/portfolio-snapshots") ? new URL(req.url, "http://localhost") : null;
  if (!snapshotsUrl) return false;

  const accessFor = async (portfolioId: string): Promise<Record<string, unknown> | undefined> => {
    const result = await databasePool.query(
      `SELECT p.id, p.reporting_currency_code, pm.role
       FROM spaartrack.portfolio p
       JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = p.id
       WHERE p.id = $1 AND pm.user_id = $2 AND pm.revoked_at IS NULL AND p.status <> 'DELETED'`,
      [portfolioId, userId]
    );
    return result.rowCount ? result.rows[0] as Record<string, unknown> : undefined;
  };

  if (req.method === "GET") {
    const portfolioId = snapshotsUrl.searchParams.get("portfolio_id")?.trim() || "";
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId)) {
      json(res, 400, { error: "INVALID_SNAPSHOT_QUERY" });
      return true;
    }
    if (!await accessFor(portfolioId)) {
      json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
      return true;
    }
    const snapshots = await databasePool.query(
      `SELECT id, portfolio_id, snapshot_at, reporting_currency_code,
              portfolio_value::text, invested_capital::text, free_cash::text,
              net_cash_flow::text, realized_pnl::text, unrealized_pnl::text,
              dividend_income_gross::text, dividend_income_net::text,
              fees::text, taxes::text, price_data_as_of, fx_data_as_of,
              calculation_version, created_at
       FROM spaartrack.portfolio_snapshot
       WHERE portfolio_id = $1 ORDER BY snapshot_at DESC, id DESC`,
      [portfolioId]
    );
    const result = [];
    for (const snapshot of snapshots.rows as Array<Record<string, unknown>>) {
      const positions = await databasePool.query(
        `SELECT portfolio_snapshot_id, financial_account_id, instrument_id,
                quantity::text, average_cost::text, cost_basis::text,
                market_price::text, market_value::text, reporting_value::text,
                unrealized_pnl::text, realized_pnl::text,
                dividends_gross::text, dividends_net::text,
                portfolio_weight::text, cost_basis_weight::text
         FROM spaartrack.position_snapshot WHERE portfolio_snapshot_id = $1
         ORDER BY instrument_id, financial_account_id`,
        [snapshot.id]
      );
      result.push(snapshotResponse(snapshot, positions.rows));
    }
    json(res, 200, { snapshots: result });
    return true;
  }

  if (req.method !== "POST" || req.url !== "/api/v1/portfolio-snapshots") return false;
  try {
    const body = await readJson(req);
    const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id.trim() : "";
    const snapshotAt = typeof body.snapshot_at === "string" ? body.snapshot_at : "";
    const calculationVersion = typeof body.calculation_version === "string" && body.calculation_version.trim()
      ? body.calculation_version.trim() : "portfolio-snapshot-v1";
    if (!/^[0-9a-f-]{36}$/i.test(portfolioId) || !snapshotAt || Number.isNaN(Date.parse(snapshotAt)) || calculationVersion.length > 120) {
      json(res, 400, { error: "INVALID_SNAPSHOT_INPUT" });
      return true;
    }
    const portfolio = await accessFor(portfolioId);
    if (!portfolio) {
      json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
      return true;
    }
    const client = await databasePool.connect();
    try {
      await client.query("BEGIN");
      const ledger = await client.query(
        `SELECT lt.activity_type, lt.is_external_flow,
                le.financial_account_id::text, le.instrument_id::text,
                le.entry_kind, le.direction, le.quantity::text,
                le.amount::text, le.currency_code, le.fee_amount::text,
                le.tax_amount::text
         FROM spaartrack.ledger_transaction lt
         JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
         WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED'
           AND lt.effective_date <= $2::date
         ORDER BY lt.effective_date, lt.occurred_at, lt.id, le.id`,
        [portfolioId, snapshotAt]
      );
      const priceRows = await client.query(
        `SELECT DISTINCT ON (instrument_id) instrument_id::text, price::text, price_at, currency_code
         FROM spaartrack.instrument_price
         WHERE price_at <= $1::timestamptz
         ORDER BY instrument_id, price_at DESC, captured_at DESC, source DESC`,
        [snapshotAt]
      );
      const prices = new Map(priceRows.rows.map((row) => [String(row.instrument_id), row]));
      const positions = new Map<string, SnapshotPosition>();
      let freeCash = 0;
      let netCashFlow = 0;
      let investedCapital = 0;
      let fees = 0;
      let taxes = 0;
      let realizedPnl = 0;
      let dividendIncomeGross = 0;
      for (const row of ledger.rows as Array<Record<string, string | boolean | null>>) {
        const amount = Number(row.amount || 0);
        const fee = Number(row.fee_amount || 0);
        const tax = Number(row.tax_amount || 0);
        fees += fee;
        taxes += tax;
        if (row.entry_kind === "POSITION" && row.instrument_id) {
          const key = `${row.financial_account_id}:${row.instrument_id}`;
          const position = positions.get(key) || {
            financial_account_id: String(row.financial_account_id), instrument_id: String(row.instrument_id),
            currency_code: String(row.currency_code), quantity: 0, cost_basis: 0,
            market_price: 0, market_value: 0, unrealized_pnl: 0
          };
          const quantity = Number(row.quantity || 0);
          if (row.activity_type === "BUY") {
            position.quantity += quantity;
            position.cost_basis += amount + fee + tax;
          } else if (row.activity_type === "SELL") {
            const averageCost = position.quantity > 0 ? position.cost_basis / position.quantity : 0;
            position.quantity -= quantity;
            position.cost_basis -= averageCost * quantity;
            realizedPnl += amount - fee - tax - averageCost * quantity;
          }
          positions.set(key, position);
        }
        const isCashCredit = ["DEPOSIT", "CREDIT", "DIVIDEND", "INTEREST", "TRANSFER_IN", "REFUND", "REBATE", "RETURN_OF_CAPITAL"].includes(String(row.activity_type));
        const isCashDebit = ["WITHDRAWAL", "BUY", "TRANSFER_OUT", "FEE", "TAX", "SELL"].includes(String(row.activity_type));
        const isExternalFlowCredit = ["DEPOSIT", "CREDIT"].includes(String(row.activity_type));
        const isExternalFlowDebit = ["WITHDRAWAL"].includes(String(row.activity_type));
        if (isCashCredit) freeCash += amount;
        if (isCashDebit) freeCash -= amount;
        if (row.is_external_flow && isExternalFlowCredit) netCashFlow += amount;
        if (row.is_external_flow && isExternalFlowDebit) netCashFlow -= amount;
        if (row.is_external_flow && isExternalFlowCredit) investedCapital += amount;
        if (row.activity_type === "DIVIDEND") dividendIncomeGross += amount;
      }
      let portfolioValue = freeCash;
      let latestPriceAt: unknown = null;
      const positionRows: Array<Record<string, unknown>> = [];
      for (const position of positions.values()) {
        if (position.quantity <= 0.000000001) continue;
        const price = prices.get(position.instrument_id);
        position.market_price = Number(price?.price || 0);
        position.market_value = position.quantity * position.market_price;
        position.unrealized_pnl = position.market_value - position.cost_basis;
        if (price?.price_at && (!latestPriceAt || new Date(String(price.price_at)).getTime() > new Date(String(latestPriceAt)).getTime())) latestPriceAt = price.price_at;
        portfolioValue += position.market_value;
        positionRows.push({
          financial_account_id: position.financial_account_id, instrument_id: position.instrument_id,
          quantity: fixedAmount(position.quantity), average_cost: fixedAmount(position.cost_basis / position.quantity),
          cost_basis: fixedAmount(position.cost_basis), market_price: fixedAmount(position.market_price),
          market_value: fixedAmount(position.market_value), reporting_value: fixedAmount(position.market_value),
          unrealized_pnl: fixedAmount(position.unrealized_pnl), realized_pnl: fixedAmount(realizedPnl),
          dividends_gross: fixedAmount(dividendIncomeGross), dividends_net: fixedAmount(dividendIncomeGross),
          portfolio_weight: fixedAmount(portfolioValue ? position.market_value / portfolioValue : 0),
          cost_basis_weight: fixedAmount(investedCapital ? position.cost_basis / investedCapital : 0)
        });
      }
      const inserted = await client.query(
        `INSERT INTO spaartrack.portfolio_snapshot
           (portfolio_id, snapshot_at, reporting_currency_code, portfolio_value,
            invested_capital, free_cash, net_cash_flow, realized_pnl, unrealized_pnl,
            dividend_income_gross, dividend_income_net, fees, taxes, price_data_as_of,
            fx_data_as_of, calculation_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $12, $13, $2, $14)
         ON CONFLICT (portfolio_id, snapshot_at, calculation_version) DO NOTHING
         RETURNING id, portfolio_id, snapshot_at, reporting_currency_code,
                   portfolio_value::text, invested_capital::text, free_cash::text,
                   net_cash_flow::text, realized_pnl::text, unrealized_pnl::text,
                   dividend_income_gross::text, dividend_income_net::text,
                   fees::text, taxes::text, price_data_as_of, fx_data_as_of,
                   calculation_version, created_at`,
        [portfolioId, snapshotAt, portfolio.reporting_currency_code, portfolioValue, investedCapital, freeCash,
          netCashFlow, realizedPnl, positionRows.reduce((sum, row) => sum + Number(row.unrealized_pnl), 0),
          dividendIncomeGross, fees, taxes, latestPriceAt || null, calculationVersion]
      );
      if (!inserted.rowCount) {
        await client.query("ROLLBACK");
        json(res, 409, { error: "SNAPSHOT_ALREADY_EXISTS" });
        return true;
      }
      for (const position of positionRows) {
        await client.query(
          `INSERT INTO spaartrack.position_snapshot
             (portfolio_snapshot_id, financial_account_id, instrument_id, quantity,
              average_cost, cost_basis, market_price, market_value, reporting_value,
              unrealized_pnl, realized_pnl, dividends_gross, dividends_net,
              portfolio_weight, cost_basis_weight)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [inserted.rows[0].id, position.financial_account_id, position.instrument_id, position.quantity,
            position.average_cost, position.cost_basis, position.market_price, position.market_value,
            position.reporting_value, position.unrealized_pnl, position.realized_pnl,
            position.dividends_gross, position.dividends_net, position.portfolio_weight, position.cost_basis_weight]
        );
      }
      await client.query("COMMIT");
      await auditEvent(req, res, userId, "CREATE", "PORTFOLIO_SNAPSHOT", String(inserted.rows[0].id), { portfolio_id: portfolioId, calculation_version: calculationVersion });
      json(res, 201, snapshotResponse(inserted.rows[0], positionRows));
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error(redactedLog({ operation: "portfolio_snapshot_failed", error: error instanceof Error ? error.message : String(error) }));
      if ((error as { code?: string }).code === "23505") json(res, 409, { error: "SNAPSHOT_ALREADY_EXISTS" });
      else json(res, 400, { error: "INVALID_SNAPSHOT_REQUEST" });
    } finally {
      client.release();
    }
    return true;
  } catch {
    json(res, 400, { error: "INVALID_SNAPSHOT_REQUEST" });
    return true;
  }
}

function transactionResponse(row: Record<string, unknown>, entries: Array<Record<string, unknown>>): Record<string, unknown> {
  const primaryEntry = entries[0] || {};
  return {
    id: row.id,
    portfolio_id: row.portfolio_id,
    financial_account_id: row.financial_account_id,
    paired_transaction_id: row.paired_transaction_id,
    activity_type: row.activity_type,
    activity_subtype: row.activity_subtype,
    state: row.state,
    occurred_at: row.occurred_at,
    settlement_at: row.settlement_at,
    effective_date: row.effective_date,
    source_type: row.source_type,
    import_session_id: row.import_session_id,
    description: row.description,
    external_id: row.external_id,
    external_hash: row.external_hash,
    is_external_flow: row.is_external_flow,
    metadata: row.metadata,
    voided_at: row.voided_at,
    instrument_id: primaryEntry.instrument_id,
    amount: primaryEntry.amount,
    currency_code: primaryEntry.currency_code,
    entries,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function ledgerTransactionRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/v1/ledger/replay") {
    const body = await readJson(req);
    const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id : "";
    const asOf = typeof body.as_of === "string" ? body.as_of : null;
    if (!portfolioId || (asOf && !/^\d{4}-\d{2}-\d{2}$/.test(asOf))) {
      json(res, 400, { error: "INVALID_LEDGER_REPLAY_INPUT" });
      return true;
    }
    const access = await databasePool.query(
      `SELECT 1 FROM spaartrack.portfolio_member
       WHERE portfolio_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [portfolioId, userId]
    );
    if (!access.rowCount) {
      json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
      return true;
    }
    const replayRows = await databasePool.query(
      `SELECT lt.id::text AS transaction_id, lt.effective_date::text, lt.occurred_at::text,
              lt.activity_type, lt.source_type, lt.external_id, lt.external_hash,
              lt.source_payload_id::text, lt.is_external_flow,
              le.id::text AS entry_id, le.financial_account_id::text, le.instrument_id::text,
              le.direction, le.amount::text, le.currency_code, le.quantity::text, le.unit_price::text
       FROM spaartrack.ledger_transaction lt
       JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
       WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED'
         AND ($2::date IS NULL OR lt.effective_date <= $2::date)
       ORDER BY lt.effective_date, lt.occurred_at, lt.id, le.id`,
      [portfolioId, asOf]
    );
    const balanceRows = await databasePool.query(
      `SELECT le.financial_account_id::text, le.currency_code,
              SUM(CASE WHEN le.direction = 'CREDIT' THEN le.amount ELSE -le.amount END)::numeric(28,12)::text AS amount
       FROM spaartrack.ledger_transaction lt
       JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
       WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED'
         AND ($2::date IS NULL OR lt.effective_date <= $2::date)
       GROUP BY le.financial_account_id, le.currency_code
       ORDER BY le.financial_account_id, le.currency_code`,
      [portfolioId, asOf]
    );
    const totalRows = await databasePool.query(
      `SELECT le.currency_code,
              SUM(CASE WHEN lt.is_external_flow AND le.direction = 'CREDIT' THEN le.amount ELSE 0 END)::numeric(28,12)::text AS external_contribution_amount,
              SUM(CASE WHEN lt.is_external_flow AND le.direction = 'DEBIT' THEN le.amount ELSE 0 END)::numeric(28,12)::text AS external_spending_amount
       FROM spaartrack.ledger_transaction lt
       JOIN spaartrack.ledger_entry le ON le.ledger_transaction_id = lt.id
       WHERE lt.portfolio_id = $1 AND lt.state = 'POSTED'
         AND ($2::date IS NULL OR lt.effective_date <= $2::date)
       GROUP BY le.currency_code
       ORDER BY le.currency_code`,
      [portfolioId, asOf]
    );
    const rows = replayRows.rows.map((row) => ({ ...row }));
    const balances = balanceRows.rows.map((row) => ({ ...row }));
    const totals = totalRows.rows.map((row) => ({ ...row }));
    const transactionIds = new Set(rows.map((row) => row.transaction_id));
    const sourcePayloadIds = new Set(rows.map((row) => row.source_payload_id).filter(Boolean));
    const replayHash = createHash("sha256").update(JSON.stringify({ rows, balances, totals })).digest("hex");
    json(res, 200, {
      portfolio_id: portfolioId,
      as_of: asOf,
      calculation_version: "ledger-replay-v1",
      transaction_count: transactionIds.size,
      entry_count: rows.length,
      source_payload_count: sourcePayloadIds.size,
      balances,
      totals,
      replay_hash: replayHash
    });
    return true;
  }

  const transactionMatch = req.url?.match(/^\/api\/v1\/ledger\/transactions\/([0-9a-f-]+)$/i);
  if (req.method === "GET" && transactionMatch) {
    const access = await databasePool.query(
      `SELECT lt.id, lt.portfolio_id, lt.financial_account_id, lt.activity_type, lt.activity_subtype,
              lt.state, lt.occurred_at, lt.settlement_at, lt.effective_date, lt.source_type,
              lt.paired_transaction_id, lt.description, lt.external_id, lt.import_session_id, lt.is_external_flow, lt.metadata, lt.voided_at,
              lt.external_hash,
              lt.created_at, lt.updated_at
       FROM spaartrack.ledger_transaction lt
       JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = lt.portfolio_id
       WHERE lt.id = $1 AND pm.user_id = $2 AND pm.revoked_at IS NULL`,
      [transactionMatch[1], userId]
    );
    if (!access.rowCount) {
      json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
      return true;
    }
    const entries = await databasePool.query(
      `SELECT id, financial_account_id, instrument_id, entry_kind, direction, quantity, unit_price,
              amount, currency_code, fee_amount, tax_amount, notes
       FROM spaartrack.ledger_entry WHERE ledger_transaction_id = $1 ORDER BY id`,
      [transactionMatch[1]]
    );
    json(res, 200, transactionResponse(access.rows[0], entries.rows));
    return true;
  }

  if (req.method === "PATCH" && transactionMatch) {
    const body = await readJson(req);
    const requestedState = typeof body.state === "string" ? body.state.trim().toUpperCase() : "";
    if (!transactionStates.includes(requestedState as typeof transactionStates[number])) {
      json(res, 400, { error: "INVALID_TRANSACTION_STATE" });
      return true;
    }

    const access = await databasePool.query(
      `SELECT lt.id, lt.state, lt.metadata
       FROM spaartrack.ledger_transaction lt
       JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = lt.portfolio_id
       WHERE lt.id = $1 AND pm.user_id = $2 AND pm.revoked_at IS NULL
         AND pm.role IN ('OWNER', 'EDITOR')`,
      [transactionMatch[1], userId]
    );
    if (!access.rowCount) {
      json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
      return true;
    }

    const currentState = String(access.rows[0].state);
    const allowedTransitions: Record<string, string[]> = {
      DRAFT: ["DRAFT", "PENDING", "POSTED", "VOID"],
      PENDING: ["PENDING", "POSTED", "VOID"],
      POSTED: ["POSTED", "VOID"],
      VOID: ["VOID"]
    };
    if (!allowedTransitions[currentState]?.includes(requestedState)) {
      json(res, 409, { error: "INVALID_TRANSACTION_STATE_TRANSITION" });
      return true;
    }

    const correctionReason = typeof body.correction_reason === "string" ? body.correction_reason.trim() : "";
    if (requestedState === "VOID" && !correctionReason) {
      json(res, 400, { error: "CORRECTION_REASON_REQUIRED" });
      return true;
    }

    const updated = requestedState === "VOID"
      ? await databasePool.query(
          `UPDATE spaartrack.ledger_transaction
           SET state = 'VOID', voided_at = now(),
               metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb, updated_at = now()
           WHERE id = $1
           RETURNING id, portfolio_id, financial_account_id, activity_type, activity_subtype, state,
                     occurred_at, settlement_at, effective_date, source_type, description, external_id,
                     paired_transaction_id, is_external_flow, metadata, voided_at, created_at, updated_at`,
          [transactionMatch[1], JSON.stringify({ correction_type: "VOID", correction_reason: correctionReason, corrected_by: userId })]
        )
      : await databasePool.query(
          `UPDATE spaartrack.ledger_transaction
           SET state = $2, updated_at = now()
           WHERE id = $1
           RETURNING id, portfolio_id, financial_account_id, activity_type, activity_subtype, state,
                     occurred_at, settlement_at, effective_date, source_type, description, external_id,
                     paired_transaction_id, is_external_flow, metadata, voided_at, created_at, updated_at`,
          [transactionMatch[1], requestedState]
        );
    const entries = await databasePool.query(
      `SELECT id, financial_account_id, instrument_id, entry_kind, direction, quantity, unit_price,
              amount, currency_code, fee_amount, tax_amount, notes
       FROM spaartrack.ledger_entry WHERE ledger_transaction_id = $1 ORDER BY id`,
      [transactionMatch[1]]
    );
    json(res, 200, transactionResponse(updated.rows[0], entries.rows));
    return true;
  }

  if (req.method === "POST" && req.url === "/api/v1/ledger/transactions") {
    const client = await databasePool.connect();
    try {
      const body = await readJson(req);
      const portfolioId = typeof body.portfolio_id === "string" ? body.portfolio_id : "";
      const accountId = typeof body.financial_account_id === "string" ? body.financial_account_id : "";
      const destinationAccountId = typeof body.destination_financial_account_id === "string" ? body.destination_financial_account_id : null;
      const activityType = typeof body.activity_type === "string" ? body.activity_type.trim().toUpperCase() : "";
      const state = typeof body.state === "string" ? body.state.trim().toUpperCase() : "POSTED";
      const sourceType = typeof body.source_type === "string" ? body.source_type.trim().toUpperCase() : "MANUAL";
      const occurredAt = typeof body.occurred_at === "string" ? body.occurred_at : "";
      const effectiveDate = typeof body.effective_date === "string" ? body.effective_date : "";
      const currencyCode = typeof body.currency_code === "string" ? body.currency_code.trim().toUpperCase() : "EUR";
      const externalId = typeof body.external_id === "string" && body.external_id.trim() ? body.external_id.trim() : null;
      const amount = typeof body.amount === "number" ? String(body.amount) : typeof body.amount === "string" ? body.amount.trim() : "";
      const instrumentId = typeof body.instrument_id === "string" ? body.instrument_id : null;
      const quantity = typeof body.quantity === "number" ? String(body.quantity) : typeof body.quantity === "string" ? body.quantity.trim() : null;
      const unitPrice = typeof body.unit_price === "number" ? String(body.unit_price) : typeof body.unit_price === "string" ? body.unit_price.trim() : null;
      const feeAmount = typeof body.fee_amount === "number" ? String(body.fee_amount) : typeof body.fee_amount === "string" ? body.fee_amount.trim() : "0";
      const taxAmount = typeof body.tax_amount === "number" ? String(body.tax_amount) : typeof body.tax_amount === "string" ? body.tax_amount.trim() : "0";
      const externalHash = createHash("sha256").update(JSON.stringify([
        accountId, destinationAccountId, activityType, occurredAt, effectiveDate, amount, currencyCode, sourceType,
        instrumentId, quantity, unitPrice, feeAmount, taxAmount
      ])).digest("hex");
      const requiresInstrument = ["BUY", "SELL", "DIVIDEND", "INTEREST", "DIVIDEND_IN_KIND", "STAKING_REWARD", "SPLIT"].includes(activityType);
      if (!portfolioId || !accountId || !activityTypes.includes(activityType as typeof activityTypes[number]) ||
          !transactionStates.includes(state as typeof transactionStates[number]) ||
          !sourceTypes.includes(sourceType as typeof sourceTypes[number]) || !/^[A-Z]{3}$/.test(currencyCode) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || !occurredAt || Number.isNaN(Date.parse(occurredAt)) ||
          !/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0 ||
          !/^\d+(\.\d+)?$/.test(feeAmount) || Number(feeAmount) < 0 ||
          !/^\d+(\.\d+)?$/.test(taxAmount) || Number(taxAmount) < 0 ||
          (requiresInstrument && (!instrumentId || !quantity || !unitPrice || Number(quantity) <= 0 || Number(unitPrice) <= 0)) ||
          (activityType === "TRANSFER_OUT" && destinationAccountId === accountId) ||
          (activityType === "TRANSFER_IN" && destinationAccountId)) {
        json(res, 400, { error: "INVALID_LEDGER_TRANSACTION_INPUT" });
        return true;
      }
      if (activityType === "TRANSFER_OUT" && !destinationAccountId) {
        json(res, 400, { error: "TRANSFER_DESTINATION_REQUIRED" });
        return true;
      }

      const access = await client.query(
        `SELECT pm.role FROM spaartrack.portfolio_member pm
         JOIN spaartrack.financial_account fa ON fa.portfolio_id = pm.portfolio_id
         JOIN spaartrack.portfolio p ON p.id = pm.portfolio_id
         WHERE pm.portfolio_id = $1 AND fa.id = $2 AND pm.user_id = $3 AND pm.revoked_at IS NULL
           AND p.status <> 'DELETED'`,
        [portfolioId, accountId, userId]
      );
      if (!access.rowCount || !["OWNER", "EDITOR"].includes(String(access.rows[0].role))) {
        json(res, 403, { error: "PORTFOLIO_ROLE_FORBIDDEN" });
        return true;
      }
      if (instrumentId) {
        const instrument = await client.query("SELECT 1 FROM spaartrack.instrument WHERE id = $1", [instrumentId]);
        if (!instrument.rowCount) {
          json(res, 400, { error: "INSTRUMENT_NOT_FOUND" });
          return true;
        }
      }
      if (activityType === "TRANSFER_OUT") {
        const destination = await client.query(
          `SELECT fa.id FROM spaartrack.financial_account fa
           JOIN spaartrack.portfolio_member pm ON pm.portfolio_id = fa.portfolio_id
           WHERE fa.id = $1 AND fa.portfolio_id = $2 AND pm.user_id = $3
             AND pm.revoked_at IS NULL AND pm.role IN ('OWNER', 'EDITOR')`,
          [destinationAccountId, portfolioId, userId]
        );
        if (!destination.rowCount) {
          json(res, 400, { error: "TRANSFER_DESTINATION_INVALID" });
          return true;
        }
      }

      await client.query("BEGIN");
      const duplicate = await client.query(
        `SELECT id, portfolio_id, financial_account_id, activity_type, activity_subtype, state,
                occurred_at, settlement_at, effective_date, source_type, description, external_id,
                external_hash, paired_transaction_id, is_external_flow, metadata, voided_at, created_at, updated_at
         FROM spaartrack.ledger_transaction
         WHERE financial_account_id = $1
           AND (($2::text IS NOT NULL AND external_id = $2) OR external_hash = $3)
         ORDER BY created_at LIMIT 1
         FOR UPDATE`,
        [accountId, externalId, externalHash]
      );
      if (duplicate.rowCount) {
        const existing = duplicate.rows[0] as Record<string, unknown>;
        if (externalId && existing.external_id === externalId && existing.external_hash !== externalHash) {
          await client.query("ROLLBACK");
          json(res, 409, { error: "IDEMPOTENCY_KEY_CONFLICT" });
          return true;
        }
        await client.query("COMMIT");
        const existingEntries = await databasePool.query(
          `SELECT id, financial_account_id, instrument_id, entry_kind, direction, quantity, unit_price,
                  amount, currency_code, fee_amount, tax_amount, notes
           FROM spaartrack.ledger_entry WHERE ledger_transaction_id = $1 ORDER BY id`,
          [existing.id]
        );
        json(res, 200, { ...transactionResponse(existing, existingEntries.rows), idempotent: true });
        return true;
      }

      const isTransfer = activityType === "TRANSFER_OUT";
      const isPosition = ["BUY", "SELL", "SPLIT"].includes(activityType);
      const isDebit = ["BUY", "WITHDRAWAL", "TRANSFER_OUT", "FEE", "TAX", "SELL"].includes(activityType);
      const entryKind = activityType === "FEE" ? "FEE" : activityType === "TAX" ? "TAX" : isPosition ? "POSITION" : "CASH";
      const direction = isDebit ? "DEBIT" : "CREDIT";
      const transactionResult = await client.query(
        `INSERT INTO spaartrack.ledger_transaction
           (portfolio_id, financial_account_id, activity_type, state, occurred_at, effective_date,
            description, external_id, external_hash, source_type, is_external_flow, metadata, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id, portfolio_id, financial_account_id, activity_type, activity_subtype, state,
                   occurred_at, settlement_at, effective_date, source_type, description, external_id,
                   external_hash, paired_transaction_id, is_external_flow, metadata, voided_at, created_at, updated_at`,
        [portfolioId, accountId, activityType, state, occurredAt, effectiveDate,
          typeof body.description === "string" ? body.description : null, externalId, externalHash, sourceType, !isTransfer,
          instrumentId ? JSON.stringify({ instrument_id: instrumentId }) : "{}", userId]
      );
      const entryResult = await client.query(
        `INSERT INTO spaartrack.ledger_entry
           (ledger_transaction_id, financial_account_id, instrument_id, entry_kind, direction,
            quantity, unit_price, amount, currency_code, fee_amount, tax_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, financial_account_id, instrument_id, entry_kind, direction, quantity,
                   unit_price, amount, currency_code, fee_amount, tax_amount, notes`,
        [transactionResult.rows[0].id, accountId, isPosition ? instrumentId : null, entryKind, direction,
          isPosition ? quantity : null, isPosition ? unitPrice : null, amount, currencyCode, feeAmount, taxAmount]
      );
      if (isTransfer) {
        const destinationHash = createHash("sha256").update(JSON.stringify([
          destinationAccountId, accountId, "TRANSFER_IN", occurredAt, effectiveDate, amount, currencyCode, sourceType,
          null, null, null
        ])).digest("hex");
        const pairedResult = await client.query(
          `INSERT INTO spaartrack.ledger_transaction
             (portfolio_id, financial_account_id, activity_type, state, occurred_at, effective_date,
              description, external_id, external_hash, source_type, is_external_flow, metadata, created_by)
           VALUES ($1, $2, 'TRANSFER_IN', $3, $4, $5, $6, $7, $8, $9, false, $10, $11)
           RETURNING id, portfolio_id, financial_account_id, activity_type, activity_subtype, state,
                     occurred_at, settlement_at, effective_date, source_type, description, external_id,
                     external_hash, paired_transaction_id, is_external_flow, metadata, voided_at, created_at, updated_at`,
          [portfolioId, destinationAccountId, state, occurredAt, effectiveDate,
            typeof body.description === "string" ? body.description : null, externalId, destinationHash, sourceType,
            JSON.stringify({ paired_transaction_id: transactionResult.rows[0].id }), userId]
        );
        const sourceResult = await client.query(
          `UPDATE spaartrack.ledger_transaction SET paired_transaction_id = $2, updated_at = now()
           WHERE id = $1
           RETURNING id, portfolio_id, financial_account_id, activity_type, activity_subtype, state,
                     occurred_at, settlement_at, effective_date, source_type, description, external_id,
                     external_hash, paired_transaction_id, is_external_flow, metadata, voided_at, created_at, updated_at`,
          [transactionResult.rows[0].id, pairedResult.rows[0].id]
        );
        const pairedLinked = await client.query(
          `UPDATE spaartrack.ledger_transaction SET paired_transaction_id = $2, updated_at = now()
           WHERE id = $1
           RETURNING id, portfolio_id, financial_account_id, activity_type, activity_subtype, state,
                     occurred_at, settlement_at, effective_date, source_type, description, external_id,
                     external_hash, paired_transaction_id, is_external_flow, metadata, voided_at, created_at, updated_at`,
          [pairedResult.rows[0].id, transactionResult.rows[0].id]
        );
        const destinationEntry = await client.query(
          `INSERT INTO spaartrack.ledger_entry
             (ledger_transaction_id, financial_account_id, entry_kind, direction, amount, currency_code)
           VALUES ($1, $2, 'CASH', 'CREDIT', $3, $4)
           RETURNING id, financial_account_id, instrument_id, entry_kind, direction, quantity, unit_price,
                     amount, currency_code, fee_amount, tax_amount, notes`,
          [pairedResult.rows[0].id, destinationAccountId, amount, currencyCode]
        );
        await client.query("COMMIT");
        json(res, 201, { ...transactionResponse(sourceResult.rows[0], entryResult.rows), paired_transaction: transactionResponse(pairedLinked.rows[0], destinationEntry.rows) });
        return true;
      }
      await client.query("COMMIT");
      json(res, 201, transactionResponse(transactionResult.rows[0], entryResult.rows));
    } catch {
      await client.query("ROLLBACK").catch(() => undefined);
      json(res, 400, { error: "INVALID_LEDGER_TRANSACTION_REQUEST" });
    } finally {
      client.release();
    }
    return true;
  }
  return false;
}

async function identityRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local") return false;
  if (req.method === "POST" && req.url === "/api/v1/users") {
    try {
      const body = await readJson(req);
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName) {
        json(res, 400, { error: "INVALID_USER_INPUT" });
        return true;
      }
      const result = await databasePool.query(
        `INSERT INTO spaartrack.app_user (email, display_name, status)
         VALUES ($1, $2, 'ACTIVE')
         ON CONFLICT DO NOTHING
         RETURNING id, email, display_name, status, locale, timezone, default_currency_code, created_at, updated_at, deleted_at`,
        [email, displayName]
      );
      if (!result.rowCount) {
        json(res, 409, { error: "EMAIL_ALREADY_EXISTS" });
        return true;
      }
      json(res, 201, userResponse(result.rows[0]));
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        json(res, 409, { error: "EMAIL_ALREADY_EXISTS" });
      } else {
        json(res, 500, { error: "IDENTITY_STORE_UNAVAILABLE" });
      }
    }
    return true;
  }

  if (req.method === "GET" && req.url === "/api/v1/users/export") {
    const userId = await authenticatedUserId(req);
    if (!userId) {
      json(res, 401, { error: "UNAUTHENTICATED" });
      return true;
    }
    const [portfolios, grants] = await Promise.all([
      databasePool.query(
        `SELECT id, name, description, status, reporting_currency_code, privacy_scope, created_at, updated_at
         FROM spaartrack.portfolio WHERE owner_user_id = $1 ORDER BY created_at`,
        [userId]
      ),
      databasePool.query(
        `SELECT portfolio_id, role, created_at, revoked_at
         FROM spaartrack.portfolio_member WHERE user_id = $1 ORDER BY created_at`,
        [userId]
      )
    ]);
    await auditEvent(req, res, userId, "EXPORT", "USER", userId, { format: "json" });
    json(res, 200, {
      user_id: userId,
      format: "json",
      scope: "user-owned",
      generated_at: new Date().toISOString(),
      portfolios: portfolios.rows,
      grants: grants.rows,
      ledger: [],
      raw_payloads: [],
      reports: []
    });
    return true;
  }

  if (req.method === "DELETE" && req.url === "/api/v1/users/me") {
    const userId = await authenticatedUserId(req);
    if (!userId) {
      json(res, 401, { error: "UNAUTHENTICATED" });
      return true;
    }
    const client = await databasePool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE spaartrack.app_user SET status = 'DELETED', deleted_at = now(), updated_at = now()
         WHERE id = $1 AND status <> 'DELETED'
         RETURNING id, email, display_name, status, locale, timezone, default_currency_code, created_at, updated_at, deleted_at`,
        [userId]
      );
      if (!result.rowCount) {
        await client.query("ROLLBACK");
        client.release();
        json(res, 409, { error: "USER_ALREADY_DELETED" });
        return true;
      }
      await client.query(
        `UPDATE spaartrack.user_session SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId]
      );
      await client.query(
        `UPDATE spaartrack.user_totp_factor SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId]
      );
      await client.query(
        `UPDATE spaartrack.oidc_login_state SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL`,
        [userId]
      );
      await client.query(
        `UPDATE spaartrack.portfolio_member SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId]
      );
      await client.query(
        `UPDATE spaartrack.portfolio SET status = 'ARCHIVED', privacy_scope = 'PRIVATE', archived_at = now(), updated_at = now()
         WHERE owner_user_id = $1 AND status <> 'DELETED'`,
        [userId]
      );
      await client.query("COMMIT");
      client.release();
      await auditEvent(req, res, userId, "REVOKE", "USER", userId, { reason: "user_deletion" });
      json(res, 200, userResponse(result.rows[0]));
    } catch {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
      json(res, 500, { error: "USER_DELETION_FAILED" });
    }
    return true;
  }

  const statusMatch = req.url?.match(/^\/api\/v1\/users\/([0-9a-f-]+)\/status$/i);
  if (req.method === "PATCH" && statusMatch) {
    try {
      const body = await readJson(req);
      const status = body.status;
      if (typeof status !== "string" || !userStatuses.includes(status as UserStatus)) {
        json(res, 400, { error: "INVALID_USER_STATUS", allowed_statuses: userStatuses });
        return true;
      }
      const result = await databasePool.query(
        `UPDATE spaartrack.app_user
         SET status = $1, deleted_at = CASE WHEN $1 = 'DELETED' THEN now() ELSE NULL END
         WHERE id = $2
         RETURNING id, email, display_name, status, locale, timezone, default_currency_code, created_at, updated_at, deleted_at`,
        [status, statusMatch[1]]
      );
      if (!result.rowCount) json(res, 404, { error: "USER_NOT_FOUND" });
      else json(res, 200, userResponse(result.rows[0]));
    } catch {
      json(res, 400, { error: "INVALID_USER_REQUEST" });
    }
    return true;
  }

  const userMatch = req.url?.match(/^\/api\/v1\/users\/([0-9a-f-]+)$/i);
  if (req.method === "GET" && userMatch) {
    const result = await databasePool.query(
      `SELECT id, email, display_name, status, locale, timezone, default_currency_code, created_at, updated_at, deleted_at
       FROM spaartrack.app_user WHERE id = $1`,
      [userMatch[1]]
    );
    if (!result.rowCount) json(res, 404, { error: "USER_NOT_FOUND" });
    else json(res, 200, userResponse(result.rows[0]));
    return true;
  }
  return false;
}

async function auditRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (environment !== "local" || req.method !== "GET" || req.url !== "/api/v1/audit") return false;
  const userId = await authenticatedUserId(req);
  if (!userId) {
    json(res, 401, { error: "UNAUTHENTICATED" });
    return true;
  }
  const result = await databasePool.query(
    `SELECT id, action, entity_type, entity_id, after_json, correlation_id, trace_id, created_at
     FROM spaartrack.audit_log WHERE actor_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [userId]
  );
  json(res, 200, { events: result.rows });
  return true;
}

type DependencyHealth = { status: "ready" | "unavailable"; reason: string };

function checkTcpDependency(rawUrl: string | undefined, dependency: string, defaultPort: number): Promise<DependencyHealth> {
  if (!rawUrl) return Promise.resolve({ status: "unavailable", reason: `${dependency}_url_missing` });
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return Promise.resolve({ status: "unavailable", reason: `${dependency}_url_invalid` });
  }
  return new Promise((resolve) => {
    const socket = createConnection({ host: target.hostname, port: Number(target.port || defaultPort) });
    const finish = (health: DependencyHealth): void => {
      socket.destroy();
      resolve(health);
    };
    socket.setTimeout(750, () => finish({ status: "unavailable", reason: `${dependency}_timeout` }));
    socket.once("connect", () => finish({ status: "ready", reason: "tcp_connection_ok" }));
    socket.once("error", (error: NodeJS.ErrnoException) => finish({
      status: "unavailable",
      reason: `${dependency}_${error.code?.toLowerCase() || "connection_failed"}`
    }));
  });
}

async function readiness(res: ServerResponse): Promise<void> {
  const [database, redis] = await Promise.all([
    checkTcpDependency(process.env.DATABASE_URL, "database", 5432),
    checkTcpDependency(process.env.REDIS_URL, "redis", 6379)
  ]);
  const ready = database.status === "ready" && redis.status === "ready";
  return json(res, ready ? 200 : 503, {
    status: ready ? "ready" : "not_ready",
    service: "api",
    dependencies: { database, redis },
    failure_reason: ready ? null : [database, redis].filter((dependency) => dependency.status !== "ready").map((dependency) => dependency.reason).join(","),
    release
  });
}

const server = createServer((req, res) => {
  const id = correlationId(req);
  const trace = traceId(req);
  const traced = res as TracedResponse;
  traced.trace_id = trace;
  traced.correlation_id = id;
  res.setHeader("x-correlation-id", id);
  res.setHeader("x-trace-id", trace);
  res.setHeader("x-service", "api");
  res.setHeader("x-release", release);
  console.log(redactedLog({
    timestamp: new Date().toISOString(),
    level: "info",
    service: "api",
    environment,
    release,
    trace_id: trace,
    correlation_id: id,
    operation: "request_received",
    method: req.method,
    path: req.url?.startsWith("/api/v1/oidc/callback") ? "/api/v1/oidc/callback" : req.url
  }));

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "authorization,content-type,x-trace-id,x-correlation-id",
      "access-control-max-age": "600"
    });
    res.end();
    return;
  }

  if (req.url?.startsWith("/api/v1/users")) {
    void identityRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "IDENTITY_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/audit")) {
    void auditRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "AUDIT_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/sessions")) {
    void sessionRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "SESSION_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/oidc")) {
    void oidcRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "OIDC_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/model-sessions")) {
    void modelSessionRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "MODEL_SESSION_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/agent-scopes")) {
    void agentScopesRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "AGENT_SCOPES_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/addons")) {
    if (req.url !== "/api/v1/addons") {
      void addonSdkRoute(req, res).then((handled) => {
        if (!handled) void addonSandboxRoute(req, res);
      }).catch(() => { if (!res.writableEnded) json(res, 500, { error: "ADDON_SDK_REQUEST_FAILED" }); });
      return;
    }
    void addonSandboxRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "ADDON_SANDBOX_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/assistant-proposals")) {
    void assistantProposalRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "ASSISTANT_PROPOSAL_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/assistant-answers")) {
    void assistantAnswerRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "ASSISTANT_ANSWER_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/push-consents")) {
    void pushConsentRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "PUSH_CONSENT_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/community/")) {
    void communityFeedRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch((error) => {
      console.error(redactedLog({ level: "error", operation: "community_feed_failed", trace_id: traceId(req), correlation_id: correlationId(req), error: error instanceof Error ? error.message : "unknown" }));
      if (!res.writableEnded) json(res, 500, { error: "COMMUNITY_FEED_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.match(/^\/api\/v1\/portfolios\/[0-9a-f-]{36}\/share-links$/i) || req.url?.match(/^\/api\/v1\/share-links\/[0-9a-f-]{36}\/revoke$/i) || req.url?.match(/^\/api\/v1\/shared\/[A-Za-z0-9_-]{12,}$/)) {
    void portfolioShareLinkRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "SHARE_LINK_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.match(/^\/api\/v1\/portfolios\/[0-9a-f-]{36}\/accountant-shares$/i)) {
    void accountantShareRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "ACCOUNTANT_SHARE_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/portfolios")) {
    void portfolioRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "PORTFOLIO_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/accountant-shares/")) {
    void accountantShareRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "ACCOUNTANT_SHARE_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/portfolio-snapshots")) {
    void portfolioSnapshotRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "PORTFOLIO_SNAPSHOT_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/report-runs")) {
    void reportRunRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "REPORT_RUN_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/goals")) {
    void goalRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "GOAL_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/cashflow-forecasts")) {
    void cashflowForecastRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "CASHFLOW_FORECAST_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url === "/api/v1/currencies" || req.url?.startsWith("/api/v1/fx/rates") || req.url?.startsWith("/api/v1/instrument-prices")) {
    void marketDataRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "MARKET_DATA_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/money-flow/account-scope")) {
    void moneyFlowAccountScopeRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "MONEY_FLOW_ACCOUNT_SCOPE_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/money-flow/activities")) {
    void moneyFlowActivitiesRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "MONEY_FLOW_ACTIVITIES_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/money-flow/analysis")) {
    void moneyFlowAnalysisRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "MONEY_FLOW_ANALYSIS_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/money-flow/currency-report")) {
    void moneyFlowCurrencyReportRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "MONEY_FLOW_CURRENCY_REPORT_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/money-flow/payees") || req.url?.startsWith("/api/v1/money-flow/tags") || req.url?.startsWith("/api/v1/money-flow/transactions/bulk-edit") || req.url?.startsWith("/api/v1/money-flow/payees-tags")) {
    void moneyFlowPayeesTagsRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "MONEY_FLOW_PAYEE_TAG_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/money-flow/rules")) {
    void moneyFlowRulesRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "MONEY_FLOW_RULE_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/money-flow/review-queue")) {
    void moneyFlowReviewRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "MONEY_FLOW_REVIEW_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/money-flow/budgets")) {
    void moneyFlowBudgetsRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "MONEY_FLOW_BUDGET_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/money-flow/categories")) {
    void moneyFlowCategoriesRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "MONEY_FLOW_CATEGORIES_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/accounts")) {
    void accountRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "ACCOUNT_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/ledger/")) {
    void ledgerTransactionRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "LEDGER_TRANSACTION_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/income-events")) {
    void incomeEventRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "INCOME_EVENT_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/income-metrics")) {
    void incomeMetricsRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "INCOME_METRICS_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/dividend-forecasts")) {
    void dividendForecastRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "DIVIDEND_FORECAST_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/dividend-summary")) {
    void dividendSummaryRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "DIVIDEND_SUMMARY_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/dividend-growth")) {
    void dividendGrowthRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "DIVIDEND_GROWTH_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/market-events")) {
    void marketEventsRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "MARKET_EVENTS_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/performance-comparison")) {
    void performanceComparisonRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "PERFORMANCE_COMPARISON_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/portfolio-comparisons")) {
    void portfolioComparisonRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => { if (!res.writableEnded) json(res, 500, { error: "PORTFOLIO_COMPARISON_FAILED" }); });
    return;
  }
  if (req.url?.startsWith("/api/v1/backtest-scenarios")) {
    void backtestScenarioRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => { if (!res.writableEnded) json(res, 500, { error: "BACKTEST_SCENARIO_FAILED" }); });
    return;
  }
  if (req.url?.startsWith("/api/v1/bond-profiles")) {
    void bondProfileRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => { if (!res.writableEnded) json(res, 500, { error: "BOND_PROFILE_REQUEST_FAILED" }); });
    return;
  }
  if (req.url?.startsWith("/api/v1/bond-metrics")) {
    void bondPricingRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => { if (!res.writableEnded) json(res, 500, { error: "BOND_PRICING_FAILED" }); });
    return;
  }
  if (req.url?.startsWith("/api/v1/bond-curve-scenarios")) {
    void bondCurveScenarioRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => { if (!res.writableEnded) json(res, 500, { error: "BOND_CURVE_SCENARIO_FAILED" }); });
    return;
  }
  if (req.url?.startsWith("/api/v1/option-contracts")) {
    void optionContractRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => { if (!res.writableEnded) json(res, 500, { error: "OPTION_CONTRACT_REQUEST_FAILED" }); });
    return;
  }
  if (req.url?.startsWith("/api/v1/option-greeks")) {
    void optionGreeksRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => { if (!res.writableEnded) json(res, 500, { error: "OPTION_GREEKS_REQUEST_FAILED" }); });
    return;
  }
  if (req.url?.startsWith("/api/v1/option-lifecycle-events")) {
    void optionLifecycleEventRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => { if (!res.writableEnded) json(res, 500, { error: "OPTION_LIFECYCLE_REQUEST_FAILED" }); });
    return;
  }
  if (req.url?.startsWith("/api/v1/option-positions")) {
    void optionPositionRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => { if (!res.writableEnded) json(res, 500, { error: "OPTION_POSITION_REQUEST_FAILED" }); });
    return;
  }
  if (req.url?.startsWith("/api/v1/wheel-cycles")) {
    void wheelCycleRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => { if (!res.writableEnded) json(res, 500, { error: "WHEEL_CYCLE_FAILED" }); });
    return;
  }
  if (req.url?.startsWith("/api/v1/alternative-asset-valuations")) {
    void alternativeAssetValuationRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => { if (!res.writableEnded) json(res, 500, { error: "ALTERNATIVE_ASSET_FAILED" }); });
    return;
  }
  if (req.url?.startsWith("/api/v1/fire-scenarios")) {
    void fireScenarioRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => { if (!res.writableEnded) json(res, 500, { error: "FIRE_SCENARIO_FAILED" }); });
    return;
  }
  if (req.url?.startsWith("/api/v1/risk-metrics")) {
    void riskMetricsRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "RISK_METRICS_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/risk-contributions")) {
    void riskContributionRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "RISK_CONTRIBUTION_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/etf-exposure") || req.url?.startsWith("/api/v1/instrument-lookthrough")) {
    void etfExposureRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "ETF_EXPOSURE_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/allocation-targets")) {
    void allocationTargetsRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "ALLOCATION_TARGETS_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/screener-watchlists")) {
    void screenerWatchlistRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "SCREENER_WATCHLIST_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/rebalance-suggestions")) {
    void rebalanceSuggestionsRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => { if (!res.writableEnded) json(res, 500, { error: "REBALANCE_REQUEST_FAILED" }); });
    return;
  }
  if (req.url?.startsWith("/api/v1/benchmarks") || req.url?.startsWith("/api/v1/benchmark-observations")) {
    void benchmarkRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "BENCHMARK_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/performance-benchmark")) {
    void benchmarkComparisonRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "BENCHMARK_COMPARISON_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/alert-rules") || req.url?.startsWith("/api/v1/notifications")) {
    void alertRuleRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "ALERT_RULE_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/bunq-oauth/deployment-gate")) {
    void bunqOAuthDeploymentGateRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "BUNQ_OAUTH_GATE_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.match(/^\/api\/v1\/bank-requisitions\/[a-z0-9-]+\/(expire|status)/i)) {
    void bankRequisitionExpiryRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "BANK_RECONNECT_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.match(/^\/api\/v1\/bank-requisitions\/[a-z0-9-]+\/revoke/i)) {
    void bankRevokeRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "BANK_REVOKE_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.match(/^\/api\/v1\/bank-requisitions\/[a-z0-9-]+\/sync/i)) {
    void bankSyncRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "BANK_SYNC_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.match(/^\/api\/v1\/bank-requisitions\/[a-z0-9-]+\/accounts/i)) {
    void bankAccountSelectionRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "BANK_ACCOUNT_SELECTION_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/bank-requisitions")) {
    void bankRequisitionRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "BANK_REQUISITION_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/bank-institutions")) {
    void bankInstitutionRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "BANK_INSTITUTION_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/providers")) {
    void providerRegistryRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "PROVIDER_REGISTRY_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/connections")) {
    void connectionRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "CONNECTION_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/sync-incidents")) {
    void syncIncidentsRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch((error) => { if (!res.writableEnded) json(res, 500, { error: "INTERNAL_ERROR" }); console.error(error); });
    return;
  }
  if (req.url?.startsWith("/api/v1/incidents")) {
    void incidentRoutingRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "INCIDENT_ROUTING_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/sync-results")) {
    void syncResultsRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "SYNC_RESULTS_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/instruments")) {
    void instrumentRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "INSTRUMENT_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/instrument-mappings")) {
    void instrumentMappingRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "INSTRUMENT_MAPPING_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/cost-basis")) {
    void costBasisRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "COST_BASIS_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/tax-lots")) {
    void taxLotsRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 400, { error: "TAX_LOTS_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/tax-lot-methods")) {
    void taxLotMethodsRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 400, { error: "TAX_LOT_METHODS_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/realized-gains")) {
    void realizedGainsRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 400, { error: "REALIZED_GAINS_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/fiscal-year-reports")) {
    void fiscalYearReportRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 400, { error: "FISCAL_YEAR_REPORT_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/tax-loss-harvesting")) {
    void taxLossHarvestingRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 400, { error: "TAX_LOSS_HARVESTING_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/wash-sale-risks")) {
    void washSaleRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 400, { error: "WASH_SALE_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/tax-worksheets")) {
    void taxWorksheetRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 400, { error: "TAX_WORKSHEET_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/pnl")) {
    void pnlRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "PNL_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/corporate-actions")) {
    void corporateActionRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "CORPORATE_ACTION_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/position-details")) {
    void positionDetailRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "POSITION_DETAIL_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/import-files")) {
    void importFileRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "IMPORT_FILE_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/degiro-imports")) {
    void degiroImportRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "DEGIRO_IMPORT_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/import-validations")) {
    void importValidationRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "IMPORT_VALIDATION_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/import-row-reviews/")) {
    void importRowReviewRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "IMPORT_ROW_REVIEW_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/reconciliation-issues")) {
    void reconciliationIssueRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "RECONCILIATION_ISSUE_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/import-sessions/")) {
    if (req.url.endsWith("/undo")) {
      void importUndoRoute(req, res).then((handled) => {
        if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
      }).catch(() => { if (!res.writableEnded) json(res, 500, { error: "IMPORT_UNDO_REQUEST_FAILED" }); });
      return;
    }
    void importCommitRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "IMPORT_COMMIT_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/import-mappings")) {
    void importMappingRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "IMPORT_MAPPING_REQUEST_FAILED" });
    });
    return;
  }
  if (req.url?.startsWith("/api/v1/2fa/totp")) {
    void totpRoute(req, res).then((handled) => {
      if (!handled && !res.writableEnded) json(res, 404, { error: "NOT_FOUND" });
    }).catch(() => {
      if (!res.writableEnded) json(res, 500, { error: "TOTP_REQUEST_FAILED" });
    });
    return;
  }

  if (req.method === "GET" && req.url === "/health/live") {
    return json(res, 200, { status: "ok", service: "api", release, environment, startedAt });
  }
  if (req.method === "GET" && req.url === "/health/ready") {
    void readiness(res);
    return;
  }
  if (req.method === "GET" && req.url === "/metrics") {
    res.writeHead(200, { "content-type": "text/plain; version=0.0.4" });
    return res.end("# HELP spaartrack_api_requests_total Total HTTP requests handled by the API.\n# TYPE spaartrack_api_requests_total counter\nspaartrack_api_requests_total 0\n");
  }
  if (req.method === "GET" && req.url === "/api/v1/release") {
    return json(res, 200, {
      release,
      environment,
      service: "api",
      commit_sha: commitSha,
      image_digest: imageDigest,
      migration_version: migrationVersion,
      deployed_at: deployedAt
    });
  }
  if (req.method === "GET" && req.url === "/api/v1") {
    return json(res, 200, {
      service: "spaartrack-api",
      version: "v1",
      status: "bootstrap",
      modules: ["identity", "ledger", "integrations", "market-data", "income-performance", "money-flow", "tax-reporting", "operations"]
    });
  }
  return json(res, 404, { error: "NOT_FOUND", correlation_id: id });
});

server.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    service: "api",
    environment,
    release,
    operation: "server_started",
    message: "Spaartrack API bootstrap is listening"
  }));
});

process.on("SIGTERM", () => server.close(() => void databasePool.end().finally(() => process.exit(0))));
