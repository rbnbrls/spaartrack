# B-003 Landing Evidence

**Date**: 2026-10-20 UTC
**Base main tip**: ec0bc1b (fix(tests): align harness helpers for landing)
**Landed commit**: (to be filled after commit)
**Scope**: B-003 security and production-readiness remediation (backup/restore HMAC + production TOTP key guard)

## Summary of Changes

### apps/api/src/index.ts
- **Production TOTP key guard**: Added fail-closed startup guard that refuses to boot when effective environment is "production" and `TOTP_ENCRYPTION_KEY` is missing, shorter than 32 characters, or equals the synthetic fallback.
- **Environment resolution**: `environment` is now resolved as:
  - `APP_ENV` (trimmed, lowercased) when explicitly set
  - Otherwise `NODE_ENV=production` → "production", else "local"
  - This makes the local compose stack (explicit `APP_ENV=local`) resolve to "local" while a bare production image run (`NODE_ENV=production`, no `APP_ENV`) resolves to "production"
- **Conflict detection**: Throws on `NODE_ENV=production` + `APP_ENV=local` (or vice versa) to prevent silent fail-open
- **totpKey() hardening**: In production, throws if `TOTP_ENCRYPTION_KEY` is missing/weak/synthetic; otherwise uses configured key or synthetic fallback
- **Startup guard placement**: TOTP guard runs before `PRODUCTION_OIDC_ADAPTER_UNAVAILABLE` so TOTP error surfaces first

### compose.yaml
- **api service**: Added `NODE_ENV: ${NODE_ENV:-development}` and `APP_ENV: ${APP_ENV:-${NODE_ENV:-local}}`
- **broker-worker**: Added `NODE_ENV: ${NODE_ENV:-development}` and `APP_ENV: ${APP_ENV:-${NODE_ENV:-local}}`
- **worker**: Added `NODE_ENV: ${NODE_ENV:-development}` (keeps `APP_ENV: local`)
- This ensures local compose stack gets `NODE_ENV=development` + `APP_ENV=local` → no conflict, boots with synthetic TOTP key
- Bare image run (`docker run` without compose) gets `NODE_ENV=production` (image default) + no `APP_ENV` → production → fail-closed

### infra/coolify/development.yaml
- Added `NODE_ENV: development` to runtime to match compose defaults

### infra/backup/backup-local.sh
- **HMAC sidecar**: Emits `<metadata>.hmac` containing `<hmac_key_id> <hexdigest>` computed with HMAC-SHA256 over metadata bytes using `SPARTRACK_BACKUP_HMAC_KEY`
- **Key IDs in metadata**: Added `integrity: "hmac-sha256"`, `encryption_key_id`, `hmac_key_id`
- **Environment variables**:
  - `SPARTRACK_BACKUP_HMAC_KEY` (required, distinct from passphrase)
  - `SPARTRACK_BACKUP_ENCRYPTION_KEY_ID` (default: `synthetic-local-encryption-v1`)
  - `SPARTRACK_BACKUP_HMAC_KEY_ID` (default: `synthetic-local-hmac-v1`)
- **Validation**: passphrase ≥32 chars in production, HMAC key ≥32 chars in production, distinct from passphrase, retention 1-3650 days
- **Permissions**: `chmod 700` on backup dir, `chmod 600` on artifacts/metadata/sidecar
- **Retention pruning**: `find -mtime +retention_days -delete` on postgres-*.dump.enc, object-storage-*.tar.enc, backup-*.metadata.json, backup-*.metadata.json.hmac

### infra/backup/restore-local.sh
- **HMAC verification before decrypt**: Verifies sidecar exists, recomputes HMAC over metadata bytes with `SPARTRACK_BACKUP_HMAC_KEY`, constant-time compares digest, verifies sidecar key ID matches injected `SPARTRACK_BACKUP_HMAC_KEY_ID`
- **Key version validation**: Metadata's `encryption_key_id`/`hmac_key_id` must match injected `SPARTRACK_BACKUP_ENCRYPTION_KEY_ID`/`SPARTRACK_BACKUP_HMAC_KEY_ID`
- **Metadata schema validation** (via python3): Validates required fields, exactly 2 artifacts (postgresql/object-storage), SHA-256 hex length 64, artifact filenames are safe basenames (no path traversal), retention > 0
- **Artifact path validation**: Rejects artifact filenames containing `/`, starting with `.`, or not matching basename
- **Empty restore target**: Fails if restore directory is not empty
- **Production key strength**: passphrase ≥32 chars and HMAC key ≥32 chars required when `APP_ENV=production`
- **Preserves main's tombstone replay and ledger counts**: Keeps `ledger_row_count`, `ledger_entry_count`, `ledger_entry_amount_sum`, `table_count`, `tombstones_replayed`, etc.
- **Restore report enhanced**: Added `encryption_key_id` and `hmac_key_id` fields

### infra/backup/README.md
- Updated with new environment variables, HMAC scheme documentation, key rotation guidance
- Production keys must be distinct vault references, not stored alongside backups

### tests/smoke/backup-hmac-contract.test.mjs (NEW)
- Source-level contract assertions on backup/restore scripts
- Verifies HMAC sidecar emission, key IDs, retention pruning
- Verifies restore HMAC verification before decrypt, key version checks, artifact path validation, empty target check
- Verifies production key strength checks
- Includes structural tampering detection test (HMAC mismatch detection)

### tests/runtime/api-production-startup.test.mjs (NEW)
- Docker-based runtime tests for production startup guard
- Tests: missing key → exits nonzero with TOTP_ENCRYPTION_KEY message
- Weak key → exits nonzero with TOTP_ENCRYPTION_KEY message
- Valid key → OIDC error (expected, Poort C blocked) not TOTP error
- Local mode (APP_ENV=local) → boots and serves /health/live
- NODE_ENV=production without APP_ENV → fail-closed
- APP_ENV=production overrides NODE_ENV=development → fail-closed
- NODE_ENV=production + APP_ENV=local → conflict throw

### tests/README.md
- Added `tests/runtime/` to "Actuele mappen" list (required by ISSUE-14 guard)

## HMAC Algorithm
- **Algorithm**: HMAC-SHA-256
- **Key**: `SPARTRACK_BACKUP_HMAC_KEY` (UTF-8 encoded)
- **Message**: Raw bytes of `backup-<timestamp>.metadata.json`
- **Sidecar format**: `<hmac_key_id> <hexdigest>\n` (space-separated, newline-terminated)
- **Verification**: `hmac.compare_digest` (constant-time) on digest; sidecar key ID must match injected `SPARTRACK_BACKUP_HMAC_KEY_ID`

## Key-Version Scheme
- **Encryption key ID**: `SPARTRACK_BACKUP_ENCRYPTION_KEY_ID` (default: `synthetic-local-encryption-v1`)
- **HMAC key ID**: `SPARTRACK_BACKUP_HMAC_KEY_ID` (default: `synthetic-local-hmac-v1`)
- Both recorded in metadata (authenticated by HMAC) and sidecar (HMAC key ID only)
- Restore verifies both metadata key IDs match injected environment values

## Retention Prune Command
```bash
find "$backup_dir" -maxdepth 1 -type f -mtime "+$retention_days" \
  \( -name 'postgres-*.dump.enc' -o -name 'object-storage-*.tar.enc' \
     -o -name 'backup-*.metadata.json' -o -name 'backup-*.metadata.json.hmac' \) \
  -print -delete
```
- Uses `-mtime +N` (files strictly older than N*24h)
- Prunes all four artifact families together to avoid orphans

## Startup Fail-Closed Guard String
```
TOTP_ENCRYPTION_KEY must be injected with at least 32 characters in production
```
Logged as structured JSON error to stderr, then `process.exit(1)`

## Test Results
- **pnpm typecheck**: PASS
- **pnpm lint**: PASS
- **pnpm test**: 625 tests, 479 pass, 0 fail, 146 skipped (includes 4 new B-003 contract tests)
- **Backup HMAC contract tests**: 4/4 PASS
- **Unit tests**: PASS (all green)

## Evidence Files
- This file: `infra/release/evidence-b003-landing.md`
- Modified files committed atomically
- No credentials in any files (synthetic placeholders only)