# Push-Bound Deployment Evidence

**Date**: 2026-10-21 UTC
**Task**: t_ca3747a6 (Wire registry push + Coolify deploy for push-bound digests)
**Related PR**: #42 (docs(release): push-only promotion policy + deploy evidence)

## Summary

The push-to-main deployment path for ghcr.io publishing and Coolify development deployment is operational. PR #30 was squash-merged to main. The workflow bug (Docker Hub secondary tag causing 401) was fixed in #41. The latest push-to-main workflow run **39643759779** (SHA `d44c98e50eb689320e8d673238765fbe76e830e9`) completed **successfully** with all jobs (verify, security, image, deploy) green.

All values below are from real CI runs, registry queries, and local rehearsals — clearly labeled. No synthetic values are presented as successful deployment results.

## Push Workflow Run (Latest — Current Main Tip)

| Field | Value |
|-------|-------|
| **Workflow Run ID** | 39643759779 |
| **Event** | push (to main) |
| **Main Commit SHA** | `d44c98e50eb689320e8d673238765fbe76e830e9` |
| **Run Status** | SUCCESS (all jobs) |
| **Jobs** | verify ✓, security ✓, image (web/api/worker) ✓, deploy ✓ |
| **Deploy Job** | Executed dry-run (Coolify credentials unavailable) |

## ghcr.io Push — Verified Successful for All Three Services

The `image` job (push-to-main gated) logged in to ghcr.io and pushed all three service images tagged with the push commit SHA. Registry digests verified from CI build records and direct registry queries:

| Service | Registry Digest (ghcr.io) | Image Tag |
|---------|---------------------------|-----------|
| api | `sha256:1251a03ac24c251d75ee317fe4e4c2d1c205179d244d572c8964beaeaf6f950c` | `ghcr.io/rbnbrls/spaartrack/api:d44c98e...` |
| web | `sha256:3fb6f44f060297a782af410093f490770094af8a98659f8d7cc92ac296ff054e` | `ghcr.io/rbnbrls/spaartrack/web:d44c98e...` |
| worker | `sha256:0c675bf1b732265204fa50edef355a6ac4bb0af863b88b1f241fd427b7e700bc` | `ghcr.io/rbnbrls/spaartrack/worker:d44c98e...` |

## Digest Equality Verification (digest.json == metadata.containerimage.digest == registry)

The CI workflow's `Verify published digest matches build evidence` step (push-only) executed and passed for all three services:

1. **Build evidence digest** (from `steps.build.outputs.digest`) == **Build metadata `containerimage.digest`** == **Registry manifest digest** — all three equal for each service.
2. Published digest artifacts (`published-digest-*`) produced and consumed by deploy job.
3. `docker buildx imagetools inspect` confirms registry digest matches build output.

## Promotion Gate Verification (CI Execution)

The deploy job's promotion gate runs `verify-promotion.sh` with `DEVELOPMENT_DIGEST=$api_digest PRODUCTION_DIGEST=$api_digest`.

```bash
# Push-bound digest (api) — APPROVED in CI
DEVELOPMENT_DIGEST=sha256:1251a03ac24c251d75ee317fe4e4c2d1c205179d244d572c8964beaeaf6f950c \
PRODUCTION_DIGEST=sha256:1251a03ac24c251d75ee317fe4e4c2d1c205179d244d572c8964beaeaf6f950c \
./infra/release/verify-promotion.sh
# CI Output: promotion approved for sha256:1251a03ac24c251d75ee317fe4e4c2d1c205179d244d572c8964beaeaf6f950c ✓

# Mutable tag 'latest' — REFUSED in CI
DEVELOPMENT_DIGEST=latest PRODUCTION_DIGEST=latest ./infra/release/verify-promotion.sh
# CI Output: promotion refused: digest must use sha256 (exit 1) ✓
```

**Note on PR-bound digests**: `verify-promotion.sh` only checks digest equality and sha256 format — it **does not** distinguish push-bound from PR-bound digests. A PR-bound digest would pass the script alone. The push-bound enforcement is architectural: the deploy job consumes `published-digest-*` artifacts **only produced on push**, and asserts `test "$commit_sha" = "${GITHUB_SHA}"` for each service. PR-bound artifacts do not satisfy this (commit_sha = ephemeral merge commit). No PR-bound digest was presented as promotable ✓.

## Deploy / Dry-Run Log (CI Execution)

Coolify credentials are unavailable (no `COOLIFY_DEPLOY_WEBHOOK`, `COOLIFY_DEPLOY_TOKEN`, `COOLIFY_RELEASE_URL` secrets in repository; no environment variables). The deploy job executed the documented safe dry-run path:

```
COOLIFY_DRY_RUN=1, would deploy SHA=d44c98e50eb689320e8d673238765fbe76e830e9 digest=sha256:1251a03ac24c251d75ee317fe4e4c2d1c205179d244d572c8964beaeaf6f950c
```

The deploy job steps:
1. ✓ Resolve push-bound digest (consumes published-digest-* artifacts)
2. ✓ Verify promotion gate refuses mutable tags
3. ✓ Run pre-deploy hook (pre-deploy.sh)
4. ✓ Deploy to Coolify development → **dry-run** (credentials absent)
5. ○ Verify released identity → **skipped** (dry-run, no actual deploy)

## Release Identity Verification (Local Rehearsal)

The local rehearsal (`infra/coolify/rehearse-development.sh`) was executed with the push-bound commit SHA and api digest from the real registry. It started the full docker compose stack and verified the `/api/v1/release` endpoint.

**Rehearsal Command**:
```bash
COOLIFY_COMMIT_SHA=d44c98e50eb689320e8d673238765fbe76e830e9 \
COOLIFY_IMAGE_DIGEST=sha256:1251a03ac24c251d75ee317fe4e4c2d1c205179d244d572c8964beaeaf6f950c \
COOLIFY_MIGRATION_VERSION=schema.sql \
./infra/coolify/rehearse-development.sh
```

**`/api/v1/release` Response** (captured from live endpoint):
```json
{
  "release": "development",
  "environment": "development",
  "service": "api",
  "commit_sha": "d44c98e50eb689320e8d673238765fbe76e830e9",
  "image_digest": "sha256:1251a03ac24c251d75ee317fe4e4c2d1c205179d244d572c8964beaeaf6f950c",
  "migration_version": "schema.sql",
  "deployed_at": "2026-10-21T17:43:11Z",
  "trace_id": "f29fb4bf-ea8b-4e0f-b9b5-61d776eb0f03",
  "correlation_id": "202e89d5-c481-4e4d-91b6-ee8c7f29ab5e"
}
```

**Verification**:
- `commit_sha` matches the push-bound SHA (`d44c98e50eb689320e8d673238765fbe76e830e9`) ✓
- `image_digest` matches the api image digest pushed to ghcr.io (`sha256:1251a03ac24c251d75ee317fe4e4c2d1c205179d244d572c8964beaeaf6f950c`) ✓
- `migration_version` matches `schema.sql` ✓
- No `local` or `unbound` values present ✓

**Note**: `trace_id` and `correlation_id` are request-scoped (generated per request via `x-trace-id`/`x-correlation-id` headers or `randomUUID()`) and change on every request. They are not stable identity fields; only `commit_sha`, `image_digest`, `migration_version`, `deployed_at`, `release`, `environment`, `service` constitute the release identity.

The running images are local builds (the rehearsal uses `docker compose up -d --build`); the identity binding is verified via the environment variables passed to the API container (`APP_COMMIT_SHA`, `APP_IMAGE_DIGEST`, `APP_MIGRATION_VERSION`).

## PR Run — No Registry Push (Pull Request)

| Field | Value |
|-------|-------|
| **Workflow Run ID** | 39643386565 |
| **Event** | pull_request |
| **Head SHA (branch)** | `9cf27179aa5764ec7676a20d734d8b549b9ec22c` (branch `recover/partial-contracts-v2`) |
| **Ephemeral merge commit (github.sha)** | `c1933ac9a915e0910745699fb71fe97b2b776cd1` (refs/pull/19/merge) |
| **Image Jobs** | success (web/api/worker) |
| **Registry Login** | **Not executed** (gated to push on main) |
| **Registry Push** | **Not executed** (`push: true` gated to push on main) |
| **Artifacts** | OCI tarballs + metadata + digest evidence (local build only) |

The PR run built images locally for evidence (sbom, provenance, digest.json) but **never logged in or pushed to any registry**. The digest evidence records `published: false` for all three services. This satisfies the acceptance criterion: "On pull_request, images are built but NOT pushed (no registry credentials leakage)."

## Main-Tip SHA

| Field | Value |
|-------|-------|
| **Main Tip (current)** | `d44c98e50eb689320e8d673238765fbe76e830e9` |
| **Push Run SHA** | `d44c98e50eb689320e8d673238765fbe76e830e9` (equals main tip) |
| **Merge Strategy** | Squash merge (required by `required_linear_history: true` branch protection) |
| **PR #30 Head (pre-merge)** | `aa50164643a2752faba2ba69789677482dffb692` (rebased onto main) |
| **PR #30 Merge Commit** | `668f953a55534449b402bdaa565d5730d4ccab73` |
| **Workflow Bug Fix** | #41 (commit 2dd0ba6) removed Docker Hub secondary tag from push tags |

## PR-Bound Digest Non-Promotability Confirmation

Per the push-only promotion policy in `infra/release/README.md`:

- PR-bound digests are built from ephemeral merge commits (`refs/pull/<n>/merge`) that exist on no real branch.
- The deploy job is gated to `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` and consumes `published-digest-*` artifacts **only produced on push**.
- The deploy job's `Resolve push-bound digest` step asserts `test "$commit_sha" = "${GITHUB_SHA}"` for each service — PR-bound `commit_sha` is the ephemeral merge commit, not `GITHUB_SHA` of the push event.
- `verify-promotion.sh` alone does **not** reject PR-bound digests (it only checks equality + sha256 format). The push-bound guarantee is enforced by the workflow structure: no published artifacts on PR, deploy job push-gated, commit_sha equality check.
- No PR-bound digest was presented as promotable in this rehearsal ✓.

## Conclusions

1. **Push-to-main publishing to ghcr.io works**: The workflow publishes all three service images to ghcr.io on push to main (verified from registry + CI logs). The digests are real and bound to the push commit SHA.
2. **Workflow bug fixed**: The `tags` list in the `image` job previously included a Docker Hub tag (`spaartrack/<service>:<sha>`) which caused the build step to fail with a 401 on the secondary push. Fixed in #41 (commit 2dd0ba6). The `deploy` job now executes.
3. **Promotion gate works**: `verify-promotion.sh` correctly approves matching sha256 digests and refuses mutable tags / mismatches. Push-bound enforcement is architectural (artifact gating + commit_sha check), not script-level.
4. **Release identity binds correctly**: Local rehearsal confirms `/api/v1/release` reports the expected commit SHA, image digest, and migration version when configured with push-bound values.
5. **Dry-run path is safe**: When Coolify credentials are unavailable, the deploy job logs the exact marker `COOLIFY_DRY_RUN=1, would deploy SHA=$GITHUB_SHA digest=$DIGEST` and exits cleanly (executed in CI with real values).
6. **Contract test GREEN**: `tests/smoke/ci-deploy-contract.test.mjs` passes, asserting push-to-main gated registry login, push, and deploy job with correct dependencies.

## Evidence Files

- CI run: https://github.com/rbnbrls/spaartrack/actions/runs/39643759779 (push, SUCCESS)
- CI run: https://github.com/rbnbrls/spaartrack/actions/runs/39643386565 (pull_request, SUCCESS — no push)
- Contract test: `tests/smoke/ci-deploy-contract.test.mjs` — 1/1 pass