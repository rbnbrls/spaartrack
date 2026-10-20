# ADR-0005: Privacy retention and backup/restore semantics (US-0206 / TC-US-0206)

## Status

Accepted. The retention and deletion contract is already shipped in
`apps/api/src/privacy*.ts`, `database/schema.sql` and migration
`0029-privacy-deletion-tombstone.sql`. This ADR documents the decision
that those files already reference.

## Context

US-0206 requires that a data subject can export their personal data and
request erasure of their account. The system segments data into
categories with different retention obligations:

- `ledger_transaction` / `ledger_entry` are the canonical financial
  history. They must not be physically deleted and must remain correctable
  via `void`/`correction`, not via `DELETE` (ADR-0002, AGENTS.md).
- `audit_log` must remain to prove that a deletion happened.
- `user_session`, `user_totp_factor`, `credential_secret_ref`,
  `external_connection`, `portfolio_member` and similar rows carry the
  data subject's ability to act or to be identified through a third party.
  They must be closed (revoked/anonymised) but not physically dropped
  except where the data itself is PII (`auth_identity`, `tax_residency`).

Two additional requirements constrain the implementation:

1. The deletion must be atomic: either every revocation succeeds or the
   request fails and no partial deletion is reported.
2. After a disaster restore from a backup, a previously deleted account
   must not be resurrected — sessions must stay revoked, the email must
   stay anonymised, and third-party grants on the owner's portfolios must
   stay revoked.

Without an explicit replay mechanism, a backup taken *before* the
deletion, when restored, puts the database back to the pre-deletion
state: `user_status=ACTIVE`, email restored, sessions/credential
references/connections unrevoked. That is the resurrection QA
reproduced end-to-end with a real `pg_dump` / `openssl enc` / `pg_restore`
cycle (F3). The mitigation is a durable tombstone that survives the dump
and can be replayed on restore.

## Decision

### Retention

`PRIVACY_RETENTION_POLICY` in `apps/api/src/privacy.ts` travels with
every export bundle so the data subject is told how long each category
is kept and what a deletion does:

- Ledger: `portfoliolevensduur; archiveren in plaats van wissen`
  (`physical_delete_on_user_request=false`).
- Raw payloads: `retention_days=30` (reference + checksum in the export,
  content follows the source retention).
- Audit: `langer dan operationele logs` (`physical_delete_on_user_request=false`).
- Identity: `accountlevensduur + soft-delete` (email + display name
  anonymised on deletion, row retained).
- Deletion receipt (`privacy.ts:PRIVACY_RETENTION_POLICY.deletion`):
  see the table below.

| What the deletion touches | How it is closed |
|---|---|
| `user_session` | `revoked_at` |
| `user_totp_factor` | `revoked_at` |
| `oidc_login_state` | `consumed_at` |
| `portfolio_member` (subject-held AND grants on subject-owned portfolios) | `revoked_at` |
| `portfolio_share_link` | `revoked_at` |
| `accountant_share` | `revoked_at` |
| `portfolio` (owned by subject) | `ARCHIVED + privacy_scope PRIVATE, hidden from non-ACTIVE member reads` |
| `external_connection` | `REVOKED + disconnected_at` |
| `connection_scope` | `revoked_at` |
| `consent_record` | `REVOKED + revoked_at` |
| `credential_secret_ref` | `revoked_at` (row kept, `vault_path` never returned in export) |
| `push_consent` | `REVOKED + revoked_at` |
| `app_user` | `status=DELETED, email=NULL, display_name='Verwijderd gebruiker'` |
| `auth_identity` | physical `DELETE` (included in export before deletion) |
| `tax_residency` | physical `DELETE` |

Only the two rows above are `DELETE FROM` statements; every other
deletion step is a status/revocation update, so the history stays
intact.

### Tombstone

`user_deletion_tombstone` (migration 0029) is the durable proof of a
deletion request. It records who was deleted, when, how long the row
is retained (`retention_until`), what was revoked (per-category counts),
and the `audit_event_id` / `actor_id` / `correlation_id` / `trace_id`
that make the deletion attributable and traceable. The table is
deliberately not a foreign key to `app_user` so it survives any future
physical purge of the identity row and — crucially — survives in the
`pg_dump` taken *after* a deletion, because it lives inside the
`spaartrack` schema.

### Restore-time replay

`infra/backup/restore-local.sh` is the only supported local restore
path. After `pg_restore`, it replays every tombstone:

- for each tombstoned `user_id`: set `app_user.status='DELETED'`,
  `email=NULL`, `display_name='Verwijderd gebruiker'`;
- re-apply every revocation in the same set the live deletion plan
  uses (`user_session`, `user_totp_factor`, `oidc_login_state`,
  `portfolio_member` both directions, `portfolio_share_link`,
  `accountant_share`, owned `portfolio`s, `external_connection`,
  `connection_scope`, `consent_record`, `credential_secret_ref`,
  `push_consent`, `auth_identity` drop, `tax_residency` drop) —
  idempotently: `WHERE ... IS NULL` / `status <> 'DELETED'` guards
  mean a second replay is a no-op.

If a backup was taken *before* a deletion, the tombstone is not in
that backup and therefore not replayed. That case is unavoidable with a
point-in-time dump: the backup, by definition, predates the deletion.
The operational control for that case is outside this schema — on every
real backup the current tombstone set is also exported as a sidecar file
and fed to the restore. For the local `backup-local.sh` / `restore-local.sh`
path the sidecar is not yet shipped; the local path today covers Case B
(backup after deletion). A future production backup must carry the sidecar
or the restore must consult the tombstone store that outlives backups.

### Vault material

`credential_secret_ref.vault_path` is the locator of the secret inside
the vault adapter. The row's locator is intentionally included in the
`pg_dump` (it is metadata), but the material inside the vault is not in
the database and is not encrypted inside the dump. The deletion revokes
the reference (`revoked_at`); the vault material itself is purged by the
vault adapter, not by this flow (`credential_material_purged_from_vault=false`
in the receipt until a real provider is wired).

### Export scope

The export bundle's `scope` is `user-owned`: ownership by `user_id` or
`owner_user_id`. Granted-portfolio ledger history is not included —
including it would leak a third party's financial history through the
grantee's export. The grantee's own `grants` rows (their membership) are
included; no portfolio/ledger rows follow for those `portfolio_id`s.

`auth_identity` is included in the export because it is deleted on user
deletion; without inclusion the data subject could never obtain a copy.

`sessions`, `totp_factors`, `oidc_login_state`, `portfolio_share_link`,
`accountant_share` and `push_consent` are intentionally excluded from the
portable bundle: they carry hashed/encrypted secret material and are
transient authentication/link artefacts, not GDPR Art. 20 portable content.
The exclusion is documented in both `privacy-export.ts` and the export's
`retention` section.

## Consequences

- The ledger is preserved; no physical `DELETE` touches `ledger_*`.
- Deletion is atomic (single transaction) and writes both an attributable
  `audit_log` row and a `user_deletion_tombstone` row that commit together.
- Third parties no longer see an `ARCHIVED` owner's data: `portfolio`
  reads require `status='ACTIVE'` and grants on the deleted owner's
  portfolios are revoked in the deletion plan itself.
- A restored service cannot silently resurrect a deleted account whose
  tombstone shipped inside the backup. Pre-deletion backups still need an
  external tombstone sidecar for full protection — that sidecar is a
  production-only control, not required for Poort C on the local stack.
- `vault_path` survives in dumps as metadata; the real gate is revocation
  plus future vault purge, not omission from the dump.
- The export redaction (`privacyExportJson`) is the fail-closed second
  layer on top of the SQL allow-list; it covers every section including
  nested JSONB.

## Non-goals

This ADR does not claim a real vault purge, a real identity provider,
recovery ceremony or Poort C production approval. Those remain blockers
until independently validated.
