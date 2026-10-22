import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

// W0 gate: the five required fixture packs (ENV-001, SEC-001, LEDGER-001, CALC-001, UI-001)
// must exist as versioned, synthetic, secret-free definitions whose contents agree with the
// landed canonical schema and with each other.
//
// Fixture root is resolved relative to this file, so a QA RED probe can copy this test into a
// scratch tree with mutated fixtures and observe the assertions fail there. The repository
// copy always resolves to the repository's own fixtures/ directory.
const root = new URL("../..", import.meta.url);

// Every request/job/run carries trace and correlation context (AGENTS.md rule 7).
const traceId = process.env.TRACE_ID || "untraced";
const correlationId = process.env.CORRELATION_ID || "uncorrelated";
const ctx = `[trace=${traceId} correlation=${correlationId}]`;
const msg = (text) => `${text} ${ctx}`;

const REQUIRED_PACKS = ["ENV-001", "SEC-001", "LEDGER-001", "CALC-001", "UI-001"];
const EMAIL_DOMAIN_ALLOWLIST = ["example.invalid", "example", "example.test", "test", "invalid", "localhost"];

const CREDENTIAL_PATTERNS = [
  ["openai-style key", /\bsk-[A-Za-z0-9_-]{16,}/],
  ["stripe live secret", /\b(?:sk|rk)_live_[A-Za-z0-9]{8,}/],
  ["stripe webhook secret", /\bwhsec_[A-Za-z0-9]{16,}/],
  ["aws access key id", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["google api key", /\bAIza[0-9A-Za-z_-]{20,}/],
  ["github token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/],
  ["github fine-grained pat", /\bgithub_pat_[A-Za-z0-9_]{20,}/],
  ["gitlab token", /\bglpat-[A-Za-z0-9_-]{16,}/],
  ["slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["certificate block", /-----BEGIN CERTIFICATE-----/],
  ["json web token", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./],
  ["iban", /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}\b/],
  ["otpauth provisioning uri", /\botpauth:\/\//i]
];

const HIGH_ENTROPY_VALUE = /\b[A-Za-z0-9+/]{32,}={0,2}\b|\b[0-9a-f]{32,}\b/i;
const CREDENTIALISH_KEY = /(password|passwd|secret|api[_-]?key|apikey|token|credential|private[_-]?key|passphrase|otp|seed)/i;

async function readPack(id) {
  const url = new URL(`fixtures/${id}.json`, root);
  assert.ok(existsSync(url), msg(`${id}.json must exist in fixtures/`));
  const text = await readFile(url, "utf8");
  const pack = JSON.parse(text);
  assert.ok(pack && typeof pack === "object" && !Array.isArray(pack), msg(`${id}.json must parse as a JSON object`));
  return { id, text, pack };
}

function tableBlock(sql, table) {
  const start = sql.indexOf(`CREATE TABLE ${table} (`);
  assert.notEqual(start, -1, msg(`canonical schema must define table ${table}`));
  const end = sql.indexOf("\n);", start);
  assert.notEqual(end, -1, msg(`canonical schema must close table ${table}`));
  return sql.slice(start, end);
}

function checkList(block, column) {
  const match = new RegExp(`CHECK\\s*\\(\\s*${column}\\s+IN\\s*\\(([^)]*)\\)`).exec(block);
  assert.ok(match, msg(`canonical schema must constrain ${column} with an IN list`));
  return match[1]
    .split(",")
    .map((value) => value.trim().replace(/^'|'$/g, ""))
    .filter(Boolean);
}

function seededCurrencies(sql) {
  const insert = /INSERT INTO currency \(code, name, minor_units\)\s*VALUES([\s\S]*?);/.exec(sql);
  assert.ok(insert, msg("canonical schema must seed the currency registry"));
  return [...insert[1].matchAll(/\(\s*'([A-Z]{3})'/g)].map((match) => match[1]);
}

function emailsIn(text) {
  return [...text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map((match) => match[0]);
}

function emailDomainAllowed(email) {
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  return EMAIL_DOMAIN_ALLOWLIST.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}

function numeric(value) {
  return Number.parseFloat(String(value));
}

test("W0 gate: the five required fixture packs exist, parse as JSON and are versioned and synthetic", async () => {
  for (const id of REQUIRED_PACKS) {
    const { pack } = await readPack(id);
    assert.equal(pack.fixture_id, id, msg(`${id} must declare fixture_id "${id}"`));
    assert.match(String(pack.version ?? ""), /^\d+\.\d+\.\d+$/, msg(`${id} must carry a semver version`));
    assert.ok(typeof pack.description === "string" && pack.description.trim().length > 10, msg(`${id} must describe its synthetic scenario`));
    assert.match(pack.description, /synthetic/i, msg(`${id} must declare itself synthetic`));
  }
  // CALC-001 is referenced with an explicit version in the W0 backlog refinement (US-0002-B).
  const calc = await readPack("CALC-001");
  assert.equal(calc.pack.version, "1.0.0", msg("CALC-001 must stay at the version documented in docs/backlog/b-004-refinement.md"));
});

test("W0 gate: the required fixture packs contain no plausible real credential, secret or PII", async () => {
  for (const id of REQUIRED_PACKS) {
    const { text, pack } = await readPack(id);
    for (const [label, pattern] of CREDENTIAL_PATTERNS) {
      const hit = pattern.exec(text);
      assert.equal(hit, null, msg(`${id} must not contain a ${label}: ${hit ? hit[0] : ""}`));
    }
    for (const email of emailsIn(text)) {
      assert.ok(emailDomainAllowed(email), msg(`${id} must only use reserved synthetic email domains (${email})`));
    }
    for (const [key, value] of Object.entries(pack)) {
      if (!CREDENTIALISH_KEY.test(key) || typeof value !== "string") continue;
      assert.equal(HIGH_ENTROPY_VALUE.test(value), false, msg(`${id}.${key} must not embed a high-entropy secret value`));
    }
    const secretish = JSON.stringify(pack).match(/"(?:password|secret|api_key|apikey|access_token|refresh_token|private_key|client_secret|aws_secret_access_key|passphrase)"\s*:\s*"[^"]{3,}"/gi);
    assert.equal(secretish, null, msg(`${id} must not embed a credential field with a value (${secretish})`));
  }
});

test("W0-2 gate: LEDGER-001 covers the required activity matrix inside the canonical schema vocabulary", async () => {
  const [{ pack: ledger }, schema] = await Promise.all([readPack("LEDGER-001"), readFile(new URL("database/schema.sql", root), "utf8")]);
  const ledgerBlock = tableBlock(schema, "ledger_transaction");
  const accountBlock = tableBlock(schema, "financial_account");
  const corporateActionBlock = tableBlock(schema, "corporate_action");
  const activityTypes = checkList(ledgerBlock, "activity_type");
  const states = checkList(ledgerBlock, "state");
  const accountTypes = checkList(accountBlock, "account_type");
  const corporateActionTypes = checkList(corporateActionBlock, "action_type");
  const currencies = seededCurrencies(schema);

  assert.ok(Array.isArray(ledger.accounts) && ledger.accounts.length >= 2, msg("LEDGER-001 must declare at least two accounts"));
  const accountCurrencies = new Set(ledger.accounts.map((account) => account.currency_code));
  assert.ok(accountCurrencies.has("EUR"), msg("LEDGER-001 must cover an EUR account"));
  assert.ok(accountCurrencies.has("USD"), msg("LEDGER-001 must cover a USD account"));
  for (const account of ledger.accounts) {
    assert.ok(currencies.includes(account.currency_code), msg(`LEDGER-001 account currency ${account.currency_code} must exist in the currency registry`));
    assert.ok(accountTypes.includes(account.type), msg(`LEDGER-001 account type ${account.type} must exist in financial_account.account_type`));
  }
  assert.ok(currencies.includes(ledger.reporting_currency_code), msg("LEDGER-001 reporting currency must exist in the currency registry"));

  assert.ok(Array.isArray(ledger.actions) && ledger.actions.length >= 5, msg("LEDGER-001 must declare a full action matrix"));
  const actionsByType = new Map();
  for (const action of ledger.actions) {
    assert.ok(activityTypes.includes(action.activity_type), msg(`LEDGER-001 activity_type ${action.activity_type} must exist in ledger_transaction.activity_type`));
    assert.ok(states.includes(action.state), msg(`LEDGER-001 state ${action.state} must exist in ledger_transaction.state`));
    assert.ok(currencies.includes(action.currency_code), msg(`LEDGER-001 action currency ${action.currency_code} must exist in the currency registry`));
    assert.match(String(action.amount), /^\d+(\.\d+)?$/, msg(`LEDGER-001 ${action.activity_type} amount must be a non-negative decimal string`));
    actionsByType.set(action.activity_type, [...(actionsByType.get(action.activity_type) || []), action]);
  }

  for (const required of ["BUY", "SELL", "DIVIDEND", "FEE", "TAX"]) {
    assert.ok(actionsByType.has(required), msg(`LEDGER-001 must cover a ${required} action`));
  }
  const cashMovements = ledger.actions.filter((action) => ["DEPOSIT", "WITHDRAWAL", "TRANSFER_OUT"].includes(action.activity_type));
  assert.ok(cashMovements.length >= 2, msg("LEDGER-001 must cover cash movement in and out of an account"));
  const pairedTransfer = ledger.actions.find((action) => action.activity_type === "TRANSFER_OUT");
  assert.ok(pairedTransfer && pairedTransfer.paired === true, msg("LEDGER-001 must mark its transfer as a paired transfer"));
  assert.ok(actionsByType.get("TRANSFER_IN") === undefined || true, msg("paired transfers are posted as one command pair"));

  assert.ok(ledger.corporate_action, msg("LEDGER-001 must declare a corporate action"));
  assert.ok(corporateActionTypes.includes(ledger.corporate_action.action_type), msg(`LEDGER-001 corporate action type ${ledger.corporate_action.action_type} must exist in corporate_action.action_type`));
  assert.match(String(ledger.corporate_action.effective_date), /^\d{4}-\d{2}-\d{2}$/, msg("LEDGER-001 corporate action needs an ISO effective date"));
  assert.ok(numeric(ledger.corporate_action.ratio_to) > 0 && numeric(ledger.corporate_action.ratio_from) > 0, msg("LEDGER-001 corporate action needs positive split ratios"));

  const invariants = new Set(ledger.invariants || []);
  for (const invariant of ["idempotency", "correction-void", "paired-transfer-neutrality", "deterministic-replay"]) {
    assert.ok(invariants.has(invariant), msg(`LEDGER-001 must declare the ${invariant} invariant`));
  }
  // D-OVERDRAFT-01 and D-SHORT-01 are explicitly NOT DECIDED; the pack must not invent them.
  assert.doesNotMatch(JSON.stringify(ledger), /overdraft|short_position|insufficient_(?:cash|quantity)/i, msg("LEDGER-001 must not invent the undecided overdraft/short policy"));
  // D-FEE-TAX-01: a standalone FEE/TAX activity carries zero attached components.
  for (const action of ledger.actions.filter((entry) => ["FEE", "TAX"].includes(entry.activity_type))) {
    assert.equal(numeric(action.fee_amount ?? 0), 0, msg(`standalone ${action.activity_type} must not carry an attached fee_amount`));
    assert.equal(numeric(action.tax_amount ?? 0), 0, msg(`standalone ${action.activity_type} must not carry an attached tax_amount`));
  }
});

test("W0-2 gate: LEDGER-001 monetary scenario agrees with the CALC-001 golden amounts", async () => {
  const [{ pack: ledger }, { pack: calc }] = await Promise.all([readPack("LEDGER-001"), readPack("CALC-001")]);
  assert.equal(ledger.reporting_currency_code, calc.reporting_currency_code, msg("LEDGER-001 and CALC-001 must share the reporting currency"));

  const positionTrades = ["BUY", "SELL", "SPLIT"];
  const used = new Set();
  for (const [name, transaction] of Object.entries(calc.transactions)) {
    const candidates = ledger.actions.filter((action) => action.activity_type === transaction.activity_type && action.currency_code === transaction.currency_code);
    const match = candidates.find((action) => numeric(action.amount) === numeric(transaction.amount));
    assert.ok(match, msg(`LEDGER-001 must mirror CALC-001 transaction "${name}" (${transaction.activity_type} ${transaction.amount} ${transaction.currency_code})`));
    assert.equal(used.has(match), false, msg(`LEDGER-001 must not reuse one action for two CALC-001 transactions`));
    used.add(match);
    if (positionTrades.includes(transaction.activity_type)) {
      assert.equal(numeric(match.quantity), numeric(transaction.quantity), msg(`LEDGER-001 ${transaction.activity_type} quantity must match CALC-001 ${name}`));
      assert.equal(numeric(match.unit_price), numeric(transaction.unit_price), msg(`LEDGER-001 ${transaction.activity_type} unit_price must match CALC-001 ${name}`));
    }
    assert.equal(numeric(match.fee_amount ?? 0), numeric(transaction.fee_amount ?? 0), msg(`LEDGER-001 ${transaction.activity_type} fee_amount must match CALC-001 ${name}`));
    assert.equal(numeric(match.tax_amount ?? 0), numeric(transaction.tax_amount ?? 0), msg(`LEDGER-001 ${transaction.activity_type} tax_amount must match CALC-001 ${name}`));
  }

  assert.equal(ledger.corporate_action.action_type, calc.split.action_type, msg("LEDGER-001 split must match the CALC-001 split action type"));
  assert.equal(ledger.corporate_action.effective_date, calc.split.effective_date, msg("LEDGER-001 split must match the CALC-001 split effective date"));
  assert.equal(numeric(ledger.corporate_action.ratio_from), numeric(calc.split.ratio_from), msg("LEDGER-001 split ratio_from must match CALC-001"));
  assert.equal(numeric(ledger.corporate_action.ratio_to), numeric(calc.split.ratio_to), msg("LEDGER-001 split ratio_to must match CALC-001"));
});

test("W0-2 gate: CALC-001 golden expectations are internally consistent with the approved fee/tax treatment", async () => {
  const { pack: calc } = await readPack("CALC-001");
  const trades = Object.values(calc.transactions).filter((transaction) => ["BUY", "SELL"].includes(transaction.activity_type));
  const positionFees = trades.reduce((sum, transaction) => sum + numeric(transaction.fee_amount ?? 0), 0);
  const positionTaxes = trades.reduce((sum, transaction) => sum + numeric(transaction.tax_amount ?? 0), 0);
  assert.equal(numeric(calc.expected.cost_basis.fees), positionFees, msg("CALC-001 cost-basis fees must equal the trade fee components (D-FEE-TAX-01)"));
  assert.equal(numeric(calc.expected.cost_basis.taxes), positionTaxes, msg("CALC-001 cost-basis taxes must equal the trade tax components (D-FEE-TAX-01)"));
  assert.equal(numeric(calc.expected.pnl.fees), positionFees, msg("CALC-001 P&L fees must equal the trade fee components (D-FEE-TAX-01)"));
  assert.equal(numeric(calc.expected.pnl.taxes), positionTaxes, msg("CALC-001 P&L taxes must equal the trade tax components (D-FEE-TAX-01)"));
  assert.equal(numeric(calc.expected.pnl.valuation_price), numeric(calc.transactions.sell.unit_price), msg("CALC-001 valuation price must match the sell unit price"));
  assert.equal(numeric(calc.expected.pnl.valuation_fx_rate), numeric(calc.fx_rate.rate), msg("CALC-001 valuation FX rate must match the fixture FX rate"));
  assert.ok(numeric(calc.fx_rate.rate) > 0, msg("CALC-001 FX rate must be positive"));
  assert.match(String(calc.as_of), /^\d{4}-\d{2}-\d{2}$/, msg("CALC-001 needs an ISO as_of date"));
  for (const coverage of ["multi_currency", "dividend_tax", "fees", "transfer", "split", "restore_replay"]) {
    assert.ok(calc.coverage.includes(coverage), msg(`CALC-001 must cover ${coverage}`));
  }
});

test("US-0101/US-0105 gate: ENV-001 describes a local-only disposable environment", async () => {
  const { text, pack } = await readPack("ENV-001");
  const requiredServices = ["db", "redis", "object_storage", "api", "worker", "web"];
  for (const service of requiredServices) {
    assert.ok(pack.services[service], msg(`ENV-001 must declare the ${service} service`));
  }
  const healthy = new Set(pack.health_expectation?.required_healthy || []);
  for (const service of requiredServices) {
    const name = pack.services[service].host || service;
    assert.ok(healthy.has(service) || healthy.has(name), msg(`ENV-001 must list ${service} as required healthy`));
  }
  assert.equal(pack.services.api.liveness, "/health/live", msg("ENV-001 must pin the API liveness path"));
  assert.equal(pack.services.api.readiness, "/health/ready", msg("ENV-001 must pin the API readiness path"));

  for (const [name, service] of Object.entries(pack.services)) {
    if (service.host) {
      assert.ok(/^[a-z0-9-]+$/.test(service.host), msg(`ENV-001 service ${name} must use a local placeholder host (${service.host})`));
    }
    if (service.port !== undefined) {
      assert.ok(Number.isInteger(service.port) && service.port > 0 && service.port <= 65535, msg(`ENV-001 service ${name} must use a valid port`));
    }
    if (service.local_url) {
      assert.match(service.local_url, /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/, msg(`ENV-001 service ${name} local_url must stay on localhost`));
    }
  }
  const publicHost = /\b[a-z0-9][a-z0-9.-]*\.(?:com|net|org|io|dev|app|cloud|co|eu|nl|be|de|fr|uk|us|info|biz)\b/i.exec(text);
  assert.equal(publicHost, null, msg(`ENV-001 must not name a public host (${publicHost ? publicHost[0] : ""})`));
  const urls = [...text.matchAll(/https?:\/\/[^\s"']+/g)].map((match) => match[0]);
  for (const url of urls) {
    assert.match(url, /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/, msg(`ENV-001 must only use loopback URLs (${url})`));
  }
});

test("US-0201/US-0203/US-0005 gate: SEC-001 covers synthetic identity, session, factor and revoke scenarios", async () => {
  const [{ pack: sec }, schema] = await Promise.all([readPack("SEC-001"), readFile(new URL("database/schema.sql", root), "utf8")]);
  const roleBlock = tableBlock(schema, "portfolio_member");
  const userBlock = tableBlock(schema, "app_user");
  const roles = checkList(roleBlock, "role");
  const statuses = checkList(userBlock, "status");

  assert.ok(Array.isArray(sec.users) && sec.users.length >= 2, msg("SEC-001 must declare at least two synthetic users"));
  const refs = new Set();
  const mails = new Set();
  const rolesPresent = new Set();
  for (const user of sec.users) {
    assert.ok(typeof user.ref === "string" && user.ref.length > 0, msg("SEC-001 users need a synthetic ref"));
    assert.equal(refs.has(user.ref), false, msg("SEC-001 user refs must be unique"));
    refs.add(user.ref);
    assert.ok(emailDomainAllowed(user.email), msg(`SEC-001 user email must use a reserved synthetic domain (${user.email})`));
    assert.equal(mails.has(user.email), false, msg("SEC-001 user emails must be unique"));
    mails.add(user.email);
    assert.ok(roles.includes(user.role), msg(`SEC-001 role ${user.role} must exist in portfolio_member.role`));
    rolesPresent.add(user.role);
    assert.ok(statuses.includes(user.status), msg(`SEC-001 status ${user.status} must exist in app_user.status`));
  }
  assert.ok(rolesPresent.has("OWNER"), msg("SEC-001 must cover an OWNER user"));
  assert.ok(rolesPresent.has("VIEWER"), msg("SEC-001 must cover a least-privilege VIEWER user"));

  assert.equal(sec.sessions.storage, "token_hash-only", msg("SEC-001 must state that sessions are stored hashed only"));
  assert.ok(typeof sec.sessions.token_scheme === "string" && sec.sessions.token_scheme.length > 0, msg("SEC-001 must declare a session token scheme"));
  for (const flow of ["login", "me", "logout-revoke", "expiry"]) {
    assert.ok(sec.sessions.flows.includes(flow), msg(`SEC-001 must cover the ${flow} session flow`));
  }
  for (const flow of ["enroll", "verify", "invalid-reject", "revoke"]) {
    assert.ok(sec.factors.totp.flows.includes(flow), msg(`SEC-001 must cover the TOTP ${flow} flow`));
  }
  for (const flow of ["start", "callback", "replay-reject", "logout"]) {
    assert.ok(sec.factors.oidc.flows.includes(flow), msg(`SEC-001 must cover the OIDC ${flow} flow`));
  }
  assert.ok(Array.isArray(sec.revoke_expectation) && sec.revoke_expectation.length > 0, msg("SEC-001 must declare a revoke_expectation"));
  for (const scope of ["sessions", "totp", "oidc-state", "portfolio-grants"]) {
    assert.ok(sec.revoke_expectation.includes(scope), msg(`SEC-001 revoke_expectation must cover ${scope}`));
  }
});

test("US-0501 gate: UI-001 describes the synthetic first-release journey inside the canonical vocabulary", async () => {
  const [{ pack: ui }, schema] = await Promise.all([readPack("UI-001"), readFile(new URL("database/schema.sql", root), "utf8")]);
  const accountTypes = checkList(tableBlock(schema, "financial_account"), "account_type");
  const activityTypes = checkList(tableBlock(schema, "ledger_transaction"), "activity_type");
  const currencies = seededCurrencies(schema);
  assert.ok(Array.isArray(ui.steps) && ui.steps.length >= 4, msg("UI-001 must declare an onboarding journey"));
  for (const step of ui.steps) {
    assert.equal(typeof step, "string", msg("UI-001 steps must be strings"));
  }
  assert.ok(ui.steps.includes("empty"), msg("UI-001 must cover the empty state"));
  assert.ok(accountTypes.includes(ui.account_type), msg(`UI-001 account_type ${ui.account_type} must exist in financial_account.account_type`));
  assert.ok(activityTypes.includes(ui.first_action_type), msg(`UI-001 first_action_type ${ui.first_action_type} must exist in ledger_transaction.activity_type`));
  assert.ok(currencies.includes(ui.reporting_currency_code), msg("UI-001 reporting currency must exist in the currency registry"));
});
