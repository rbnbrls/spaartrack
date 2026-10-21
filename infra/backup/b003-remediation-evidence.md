# B-003 remediation and local restore evidence

Date: 2026-10-18 UTC. Scope: local-only synthetic data. No production system, vault, account, database or deployment was accessed. No secret values are recorded here.

## Changes

- API startup recognizes `NODE_ENV=production` even when `APP_ENV` is absent, rejects production/non-production conflicts (case-normalized), and rejects missing or shorter-than-32-character `TOTP_ENCRYPTION_KEY`. The local synthetic fallback remains available only outside production; this setting alone does not prove production vault custody or key rotation. Compose carries `NODE_ENV` and defaults `APP_ENV` from it; the Coolify development manifest explicitly declares both development modes.
- Local backup now requires separate encryption and HMAC secret references, rejects short/shared keys and invalid retention, writes SHA-256 ciphertext checksums, HMAC-SHA-256-authenticated metadata and key-version IDs, protects local artifact permissions, and prunes expired artifacts.
- Restore verifies the metadata HMAC in constant time before parsing metadata, checks key-version IDs, validates artifact names/checksums before decrypting, requires an empty sandbox target and compares canonical posted ledger balances/quantities, latest portfolio snapshot totals and report-run totals against authenticated backup metadata. A mismatch produces a mismatch report and nonzero exit. The temporary PostgreSQL container is cleaned up after the run.
- No ledger schema or migration was changed. CBC is retained for compatibility; HMAC supplies integrity/authenticity over the metadata carrying ciphertext hashes. Production should consider a vault-backed AEAD format as a separately reviewed migration.

## Commands and test results

- Test-first contract: `node --test tests/smoke/backup-restore-contract.test.mjs` initially failed on the three new B-003 expectations, then passed after remediation (6/6).
- Executable image startup regressions: `node --test tests/runtime/api-production-startup.test.mjs` — 5/5 passed. Built the API image, observed fail-closed exit for NODE_ENV-only production without a key and a short key, rejected conflicting environment modes, confirmed explicit local mode serves `/health/live`, confirmed production with a synthetic valid key serves `/health/live`, and confirmed `docker compose run` with production NODE_ENV and no key exits nonzero.
- Full suite: `npm test` — 172 tests, 102 passed, 0 failed, 70 skipped (runtime tests are opt-in).
- Shell/static validation: `bash -n infra/backup/backup-local.sh infra/backup/restore-local.sh`; `git diff --check` — passed.
- API image compile: `docker compose build api` — passed. Final local API image ID/digest: `sha256:ad59e7b93971f96c4219c8f843a02a19d06db289f034fb1f6b3b1ef275bba8e0` (no registry push or immutable promotion performed).
- Production fail-closed probe: exercised the built production image with `NODE_ENV=production`, `APP_ENV` absent and no TOTP key. Container exited nonzero with `TOTP_ENCRYPTION_KEY must be injected with at least 32 characters in production`; production Compose config resolved APP_ENV to production and the missing key was rejected at process startup.
- Negative restore probes: altered metadata failed with `backup metadata HMAC verification failed`; mismatched key version failed with `backup key version does not match injected key references`; authenticated but altered financial totals emitted `status=mismatch`, `financial_invariants_match=false` and exited 1.
- Retention probe: an expired synthetic backup artifact was removed by the backup retention pass.

## Isolated synthetic restore drill

Backup directory: `/Users/ruben/.hermes/profiles/platform/cache/b003-final-verified-20261018T061152Z`
Restore report: `/Users/ruben/.hermes/profiles/platform/cache/b003-final-restore-rerun-20261018T061247Z/restore-report.json`

Report result: `status=restored`, schema_count 1, row_count 104, ledger balance groups 2363, latest portfolio projections 191, report runs 88 (62 succeeded, 0 failed, 62 with artifacts), raw payload files 2, report files 1, `financial_invariants_match=true`. Expected and restored canonical-total JSON SHA-256 values both equal `f888be4e63b3d7e5a6f78674d2bb2cc9d21d7c3b664008a0948621410828ba6e`.

Artifact SHA-256:

- `backup-20261018T061152Z.metadata.json`: `490366ffad660cbd965ffe6ec73ca5f012facc85d3a43ff9562e08f4056c7633`
- `backup-20261018T061152Z.metadata.json.hmac`: `5153af45138d0bd7f3982fe7119fc217a08fa8e5d68da3812fc54933128d2cce`
- `object-storage-20261018T061152Z.tar.enc`: `9dbbee4c0734186058d40492baf359f987b02e04ea09191d9125e821ec92ce1c`
- `postgres-20261018T061152Z.dump.enc`: `ecdc1c3a03b1864f3f581d7be36f4b7c24c11bbbb6a9aca948dc871e810314f2`

## Exact platform gate

- Local remediation/restore and production-startup fail-closed gate: **PASS** for the synthetic local rehearsal and checks listed above.
- Poort B / development promotion: **NOT PROVEN**. No registry publication, immutable commit-tag promotion, Coolify development deployment or post-deploy verification was performed. The image is local and the worktree is modified; do not infer a commit-to-digest chain from this build.
- Poort C / production release: **BLOCKED — NO PRODUCTION APPROVAL**. There is no production manifest or evidence of vault references/least privilege, production threat model, human approval, production restore drill, monitoring/runbook or production release verification. Local key/restore tests do not satisfy these production requirements.

The running Compose stack was not redeployed from this build. Its health endpoints were readable, but that existing running deployment is not asserted to contain these changes. Image rollback remains separate from database restore.