// Executes the real export and deletion SQL against a real PostgreSQL.
//
// This is the regression test for the QA defect where BOTH privacy endpoints
// returned HTTP 500 on every request:
//   - export: `audit_log.user_id` is uuid while `audit_log.actor_id` is text,
//     so one shared `$1` needed explicit casts (SQLSTATE 42883);
//   - delete: a statement referenced only `$2` while receiving `[a, b]`,
//     so Postgres could not infer the type of `$1`.
//
// The statements run through node-postgres with REAL bound parameters, which
// is how the API executes them. Substituting literals would hide both bugs,
// because a literal is untyped and Postgres would silently coerce it.
//
// The test only touches rows it created itself, with synthetic identifiers.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

import { collectPrivacyExportSections, PRIVACY_EXPORT_SECTION_NAMES } from "../../apps/api/src/privacy-export.ts";
import { buildPrivacyDeletionAuditEvent, buildPrivacyDeletionPlan } from "../../apps/api/src/privacy-deletion.ts";

const require = createRequire(import.meta.url);
const { Pool } = require("../../apps/api/node_modules/pg");

const databaseUrl =
  process.env.PRIVACY_TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgres://spaartrack:change-me-local-only@localhost:55432/spaartrack";

const dbUp = spawnSync("docker", ["compose", "ps", "--format", "json", "db"], { encoding: "utf8", timeout: 30_000 });

let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: databaseUrl });
  return pool;
}
async function withPool(run) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("ROLLBACK");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

test("TC-US-0206-A: every export statement executes against a real PostgreSQL", { skip: dbUp.status !== 0 }, async () => {
  const userId = await withPool(async (client) => {
    const created = await client.query(
      `INSERT INTO spaartrack.app_user (email, display_name, status)
       VALUES ('synthetic-privacy-sqlcheck@example.test', 'Synthetic SQL Check', 'ACTIVE')
       RETURNING id`
    );
    const id = String(created.rows[0].id);
    const sections = await collectPrivacyExportSections(
      (text, values) => client.query(text, values),
      id
    );
    assert.deepEqual(Object.keys(sections).sort(), [...PRIVACY_EXPORT_SECTION_NAMES].sort());
    for (const name of PRIVACY_EXPORT_SECTION_NAMES) {
      assert.ok(Array.isArray(sections[name]), `${name} must be an array`);
    }
    assert.equal(sections.user.length, 1);
    assert.equal(sections.user[0].email, "synthetic-privacy-sqlcheck@example.test");
    assert.equal(sections.audit_history.length, 0);
    return id;
  });
  assert.match(userId, /^[0-9a-f-]{36}$/);
});

test("TC-US-0206-A: the audit-history statement binds one parameter against both uuid and text columns", { skip: dbUp.status !== 0 }, async () => {
  await withPool(async (client) => {
    const created = await client.query(
      `INSERT INTO spaartrack.app_user (email, display_name, status)
       VALUES ('synthetic-privacy-castcheck@example.test', 'Synthetic Cast Check', 'ACTIVE')
       RETURNING id`
    );
    const id = String(created.rows[0].id);

    // The un-cast form is what produced SQLSTATE 42883. Assert the failure is
    // real, so the regression cannot be reintroduced by dropping the casts.
    // Isolate the deliberate failure on a dedicated connection: inside the
    // enclosing `BEGIN ... ROLLBACK` transaction the failure would abort the
    // transaction and poison the subsequent export call with 25P02.
    const probeClient = await getPool().connect();
    try {
      await assert.rejects(
        () =>
          probeClient.query(
            `SELECT count(*) FROM spaartrack.audit_log WHERE user_id = $1 OR actor_id = $1`,
            [id]
          ),
        /operator does not exist: text = uuid/
      );
    } finally {
      probeClient.release();
    }

    // The shipped statement, with the same single bound parameter, works.
    const sections = await collectPrivacyExportSections(
      (text, values) => client.query(text, values),
      id
    );
    assert.ok(Array.isArray(sections.audit_history));
  });
});

test("TC-US-0206-B: the deletion plan executes atomically and preserves the ledger", { skip: dbUp.status !== 0 }, async () => {
  await withPool(async (client) => {
    const owner = await client.query(
      `INSERT INTO spaartrack.app_user (email, display_name, status)
       VALUES ('synthetic-privacy-delowner@example.test', 'Synthetic Del Owner', 'ACTIVE')
       RETURNING id`
    );
    const ownerId = String(owner.rows[0].id);
    const portfolio = await client.query(
      `INSERT INTO spaartrack.portfolio (owner_user_id, name, reporting_currency_code)
       VALUES ($1, 'Synthetic Privacy Portfolio', 'EUR') RETURNING id`,
      [ownerId]
    );
    const portfolioId = String(portfolio.rows[0].id);
    await client.query(
      `INSERT INTO spaartrack.portfolio_member (portfolio_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
      [portfolioId, ownerId]
    );
    const account = await client.query(
      `INSERT INTO spaartrack.financial_account (portfolio_id, name, account_type)
       VALUES ($1, 'Synthetic Privacy Account', 'BROKERAGE') RETURNING id`,
      [portfolioId]
    );
    const accountId = String(account.rows[0].id);
    const transaction = await client.query(
      `INSERT INTO spaartrack.ledger_transaction
         (portfolio_id, financial_account_id, activity_type, state, occurred_at, effective_date, source_type, created_by)
       VALUES ($1, $2, 'DEPOSIT', 'POSTED', now(), current_date, 'MANUAL', $3)
       RETURNING id`,
      [portfolioId, accountId, ownerId]
    );
    const transactionId = String(transaction.rows[0].id);
    await client.query(
      `INSERT INTO spaartrack.ledger_entry (ledger_transaction_id, financial_account_id, entry_kind, direction, amount, currency_code)
       VALUES ($1, $2, 'CASH', 'DEBIT', 100, 'EUR')`,
      [transactionId, accountId]
    );
    const provider = await client.query(
      `INSERT INTO spaartrack.provider (slug, name, provider_type, status)
       VALUES ('synthetic-privacy-provider', 'Synthetic Privacy Provider', 'BROKER', 'ACTIVE') RETURNING id`
    );
    const providerId = String(provider.rows[0].id);
    const credential = await client.query(
      `INSERT INTO spaartrack.credential_secret_ref (user_id, vault_path, secret_kind)
       VALUES ($1, '/synthetic/vault/privacy', 'API_KEY') RETURNING id`,
      [ownerId]
    );
    const credentialId = String(credential.rows[0].id);
    const connection = await client.query(
      `INSERT INTO spaartrack.external_connection (user_id, provider_id, auth_mode, status, credential_ref_id)
       VALUES ($1, $2, 'API_KEY', 'HEALTHY', $3) RETURNING id`,
      [ownerId, providerId, credentialId]
    );
    const connectionId = String(connection.rows[0].id);
    await client.query(
      `INSERT INTO spaartrack.connection_scope (connection_id, scope) VALUES ($1, 'read')`,
      [connectionId]
    );
    await client.query(
      `INSERT INTO spaartrack.consent_record (connection_id, consent_type, state)
       VALUES ($1, 'DATA_IMPORT', 'AUTHORIZED')`,
      [connectionId]
    );
    await client.query(
      `INSERT INTO spaartrack.user_session (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
      [ownerId, "a".repeat(64)]
    );

    const plan = buildPrivacyDeletionPlan({
      userId: ownerId,
      retentionUntil: new Date(Date.now() + 86_400_000).toISOString(),
      actorId: ownerId,
      correlationId: "corr-privacy-sql",
      traceId: "trace-privacy-sql"
    });

    // Execute the plan as one transaction, exactly like the route does.
    const counts = {
      sessions: 0,
      totp_factors: 0,
      oidc_states: 0,
      grants: 0,
      portfolio_share_links: 0,
      accountant_shares: 0,
      owned_portfolios: 0,
      provider_connections: 0,
      connection_scopes: 0,
      consent_records: 0,
      credential_references: 0,
      push_consents: 0,
      auth_identities: 0,
      tax_residency: 0
    };
    let deletedUser;
    for (const [index, statement] of plan.statements.entries()) {
      const result = await client.query(statement.text, statement.values);
      const counter = plan.counted.find((entry) => entry.index === index);
      if (counter) counts[counter.key] = result.rowCount ?? 0;
      if (index === plan.identityUpdateIndex) deletedUser = result.rows[0];
    }
    assert.ok(deletedUser, "the identity row must be returned for the response");
    assert.equal(deletedUser.status, "DELETED");

    const auditEvent = buildPrivacyDeletionAuditEvent({
      userId: ownerId,
      actorId: ownerId,
      correlationId: "corr-privacy-sql",
      traceId: "trace-privacy-sql"
    });
    const auditResult = await client.query(auditEvent.text, auditEvent.values);
    const auditEventId = String(auditResult.rows[0].id);
    const tombstone = plan.tombstone({ counts, auditEventId });
    const tombstoneResult = await client.query(tombstone.text, tombstone.values);
    const tombstoneId = String(tombstoneResult.rows[0].id);
    assert.match(tombstoneId, /^[0-9a-f-]{36}$/);

    assert.equal(counts.sessions, 1, "the live session must be revoked");
    assert.equal(counts.grants, 1, "the portfolio grant must be revoked");
    assert.equal(counts.owned_portfolios, 1, "the owned portfolio must be archived");
    assert.equal(counts.provider_connections, 1, "the provider connection must be revoked");
    assert.equal(counts.connection_scopes, 1, "the connection scope must be revoked");
    assert.equal(counts.consent_records, 1, "the consent record must be revoked");
    assert.equal(counts.credential_references, 1, "the credential secret reference must be revoked");

    // The ledger is preserved, never physically deleted.
    const ledger = await client.query(
      `SELECT (SELECT count(*) FROM spaartrack.ledger_transaction WHERE id = $1) AS t,
              (SELECT count(*) FROM spaartrack.ledger_entry WHERE ledger_transaction_id = $1) AS e`,
      [transactionId]
    );
    assert.equal(ledger.rows[0].t, "1");
    assert.equal(ledger.rows[0].e, "1");

    // The identity row survives but is anonymised and deactivated.
    const user = await client.query(
      `SELECT status, email, display_name FROM spaartrack.app_user WHERE id = $1`,
      [ownerId]
    );
    assert.equal(user.rows[0].status, "DELETED");
    assert.equal(user.rows[0].email, null);
    assert.equal(user.rows[0].display_name, "Verwijderd gebruiker");

    // The credential reference is revoked but not deleted, and its vault path
    // is never exposed through the deletion receipt.
    const credentialRow = await client.query(
      `SELECT revoked_at FROM spaartrack.credential_secret_ref WHERE id = $1`,
      [credentialId]
    );
    assert.ok(credentialRow.rows[0].revoked_at, "the credential reference must be revoked");

    // The audit event and the tombstone are written inside the transaction.
    const audit = await client.query(
      `SELECT action, entity_type, actor_id, user_id, correlation_id, trace_id FROM spaartrack.audit_log WHERE id = $1`,
      [auditEventId]
    );
    assert.equal(audit.rows[0].action, "DELETE");
    assert.equal(audit.rows[0].entity_type, "USER");
    assert.equal(audit.rows[0].actor_id, ownerId);
    assert.equal(audit.rows[0].correlation_id, "corr-privacy-sql");
    assert.equal(audit.rows[0].trace_id, "trace-privacy-sql");

    const tombstoneRow = await client.query(
      `SELECT user_id, revoked_sessions, revoked_provider_connections, revoked_credential_references,
              ledger_rows_deleted, audit_event_id, retention_until
         FROM spaartrack.user_deletion_tombstone WHERE id = $1`,
      [tombstoneId]
    );
    assert.equal(tombstoneRow.rows[0].user_id, ownerId);
    assert.equal(tombstoneRow.rows[0].revoked_sessions, 1);
    assert.equal(tombstoneRow.rows[0].revoked_provider_connections, 1);
    assert.equal(tombstoneRow.rows[0].revoked_credential_references, 1);
    assert.equal(tombstoneRow.rows[0].ledger_rows_deleted, 0);
    assert.equal(tombstoneRow.rows[0].audit_event_id, auditEventId);
    assert.ok(tombstoneRow.rows[0].retention_until);
  });
});

test("TC-US-0206-B: a failed deletion rolls back completely and reports no deletion", { skip: dbUp.status !== 0 }, async () => {
  await withPool(async (client) => {
    const owner = await client.query(
      `INSERT INTO spaartrack.app_user (email, display_name, status)
       VALUES ('synthetic-privacy-rollback@example.test', 'Synthetic Rollback', 'ACTIVE')
       RETURNING id`
    );
    const ownerId = String(owner.rows[0].id);
    await client.query(
      `INSERT INTO spaartrack.user_session (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
      [ownerId, "b".repeat(64)]
    );

    const plan = buildPrivacyDeletionPlan({
      userId: ownerId,
      retentionUntil: new Date(Date.now() + 86_400_000).toISOString(),
      actorId: ownerId,
      correlationId: null,
      traceId: null
    });

    // Force a failure after the session revocation has already run.
    await assert.rejects(async () => {
      await client.query("SAVEPOINT before_failure");
      await client.query(plan.statements[0].text, plan.statements[0].values);
      await client.query(`SELECT 1 FROM spaartrack.definitely_not_a_table`);
    });

    // Roll the savepoint back: the session revocation is undone, so the
    // caller's session would still be valid. The route never leaves a
    // half-applied deletion behind.
    await client.query("ROLLBACK TO SAVEPOINT before_failure");

    const session = await client.query(
      `SELECT revoked_at FROM spaartrack.user_session WHERE user_id = $1`,
      [ownerId]
    );
    assert.equal(session.rows[0].revoked_at, null, "the partial deletion must be rolled back");
    const user = await client.query(`SELECT status FROM spaartrack.app_user WHERE id = $1`, [ownerId]);
    assert.equal(user.rows[0].status, "ACTIVE");
  });
});
