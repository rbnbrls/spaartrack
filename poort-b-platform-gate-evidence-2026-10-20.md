> **HISTORICAL SNAPSHOT — superseded on 20 October 2026. Do not read the claims
> below as a live release gate.**
>
> This document is a point-in-time snapshot taken on the branch
> `fix/US-0103-ci-bootstrap-and-gitleaks-depth` at `04756c0`. It is **not** the
> current gate status; the roadmap (`roadmap.md`) is the single source of truth
> for gate status.
>
> What has changed since this snapshot was written:
>
> - **PR #2 is merged.** The pull request referenced above
>   (`https://github.com/rbnbrls/spaartrack/pull/2`) landed on `main` as
>   `c6620cf`. The document is no longer describing an open change.
> - **The digests quoted below belong to `pull_request` merge commits**, not to
>   a promotable branch-bound artifact. A `refs/pull/2/merge` commit is
>   ephemeral and is regenerated on every push; it is not the commit that
>   `main` points at. The digests are therefore **not** promotable to any
>   environment. The only branch-bound digest is the one produced by the
>   `push` run on `origin/main` (`c6620cf`), which is the digest that a
>   promotion must carry.
> - **`main` was, at the time of writing, unprotected** ("no branch protection"
>   in the header below). That is no longer true: since 20 October 2026 `main`
>   is protected and requires the five status checks `verify`, `security`,
>   `image (api)`, `image (web)` and `image (worker)`, with linear history and
>   stale-review dismissal. See `infra/policies/release-policy.yaml`.
> - **"Poort B is PROVEN" is too strong and has been withdrawn.** The
>   independent platform audit of 20 October 2026
>   (`audit-poort-b-platform-gate-2026-10-20.md`, card `t_a6ed1c6a`) found
>   that the platform gate is **NOT PROVEN**: SAST and container-scan are
>   unimplemented, there is no migration runner, no registry push and no
>   deploy step in CI, no rollback rehearsal, and the PR-bound digest was
>   vacuous on push. The claim in this document predates those gaps and must
>   not be cited as proof.
>
> Retained unchanged below as the historical record of what was measured on
> 20 October 2026.

# Poort B — platform gate evidence (SHA-bound CI → digest → release identity)

Date: 2026-10-20
Owner: `platform` (card B-001 — Coolify development deployment evidence)
Repository: `rbnbrls/spaartrack` (public, default branch `main`, **no branch protection** — *historical: `main` was unprotected when this was written; protection was enabled later the same day*)
Branch: `fix/US-0103-ci-bootstrap-and-gitleaks-depth`
Pull request: https://github.com/rbnbrls/spaartrack/pull/2 (*merged as `c6620cf`; the digests below are `pull_request` merge-commit digests and are not promotable*)

**Exact platform gate: Poort B is PROVEN up to (and including) the SHA-bound CI +
immutable digest + release-identity chain. The Coolify development deployment itself,
the external observability window and the rollback rehearsal against a real prior
release remain BLOCKED on operator-provided external access.**

---

## 1. What was wrong before this task

Four remote CI runs existed; the `image` job was `skipped` in **all four**, so no
image digest, SBOM or provenance had ever been produced and no Coolify deployment
had ever run.

| run | event | SHA | verify | security | image |
|---|---|---|---|---|---|
| 39066748865 | push | `cf5e8c4` | failure | success | skipped |
| 39311058782 | push | `c01d481` | failure | failure | skipped |
| 39373744458 | pull_request | `24fa997` | failure | failure | skipped |
| 39373803650 | push (main) | `4fb71c6` | failure | failure | skipped |

Root causes, each confirmed against the actual remote log (not inferred):

- **Blocker A — `verify` / "Start API bootstrap" (exit code 7).**
  The step ran `node apps/api/dist/index.js`. Commit `24fa997` made `apps/api`
  import from `packages/integration-contracts`, which shifts the inferred `tsc`
  rootDir to the repo root, so the build emits
  `apps/api/dist/apps/api/src/index.js` and `apps/api/dist/index.js` **does not
  exist**. Verified locally on a clean emit: the only `index.js` is under
  `apps/api/dist/apps/api/src/`.

- **Blocker B — `security` / "Secret scan" (exit code 1).**
  `gitleaks-action@v2` scans `<before>^..<after>`, but `actions/checkout@v4`
  defaults to `fetch-depth: 1`, so `<before>^` was absent and `git log` aborted
  with `unknown revision`. Not a leak: the scan itself reported no leaks.

- **Blocker C — `security` / "Secret scan" (exit code 1, PR events only).**
  After `fetch-depth: 0` fixed the range, the *next* blocker surfaced, visible
  only on `pull_request` events:

      ##[error]🛑 GITHUB_TOKEN is now required to scan pull requests.

  Confirmed in upstream source (`gitleaks-action` `src/gitleaks.js`,
  `ScanPullRequest`): the function calls `process.exit(1)` when
  `process.env.GITHUB_TOKEN` is absent — **before** any scan runs. The `push`
  branch of the action never hits that path, which is why only the PR run failed
  on it.

- **Blocker D — `image` job produced no digest evidence.**
  The workflow passed `metadata-file:` to `docker/build-push-action@v6`, but that
  action has no such input. The run confirmed:
  `##[warning]Unexpected input(s) 'metadata-file', valid inputs are [...]`.
  The action passes its own `--metadata-file` to buildx and exposes the result as
  the step outputs `digest`, `imageid` and `metadata`. The path was silently
  dropped, so `/tmp/spaartrack-<svc>.metadata.json` was never written and the
  uploaded artifact contained only the OCI tar — no digest, no SBOM, no
  provenance index. The contract test `TC-US-0104-B` asserted on the presence of
  `metadata-file:` and therefore **protected the defect**.

- **Blocker E — image identity was a mutable branch name.**
  `APP_VERSION` and `org.opencontainers.image.version` used `github.ref_name`,
  which is `<n>/merge` on a pull request (the run confirmed `APP_VERSION=2/merge`)
  and `main` on a push. Neither is a version identifier.

- **Blocker F — restore evidence mislabelled a table count as a row count.**
  `infra/backup/restore-local.sh` populated `row_count` from
  `SELECT count(*) FROM information_schema.tables ...` — a **table** count. The
  roadmap cites that field as restore-row proof ("row_count: 98"). The rehearsal
  reported `row_count: 117` while the ledger held 6962 transactions and 6962
  entries. `TC-US-0107-B` asserted only that the string `row_count` existed.

---

## 2. Fixes (all test-first, RED → GREEN)

| commit | scope | RED | GREEN |
|---|---|---|---|
| `3d85c25` | bootstrap starts the emitted entrypoint; `fetch-depth: 0` | 2/4 fail | 4/4 pass |
| `b47bde6` | `GITHUB_TOKEN` + `pull-requests: write`; gitleaks v3; checkout v6 | 5: 3 pass / 2 fail | 5/5 pass |
| `8f4ad50` | digest evidence from real step outputs; SHA-based image identity | 6: 4 pass / 2 fail | 6/6 pass |
| `562c9b0` | real ledger row/entry/sum in restore report | 5: 4 pass / 1 fail | 5/5 pass |

No gate was weakened at any point: `needs: [verify, security]` intact, no
`continue-on-error`, no `|| true`, no `GITLEAKS_ENABLE_COMMENTS=false`, the secret
scan stays blocking, and the `image` job stays gated behind both blocking jobs.

Full suite progression: 542 → 544 → 545 → 547 → **548 tests / 415 pass / 0 fail /
133 skipped**. `tsc --noEmit` green for both `lint` and `typecheck` at every step.

---

## 3. The SHA-bound remote run

Run `39387809501`, PR #2, all five jobs green:

```
verify           SUCCESS
security         SUCCESS
image (web)      SUCCESS
image (api)      SUCCESS
image (worker)   SUCCESS
```

Earlier green runs on the same PR: `39386688001` (all 5 green) and
`39385629397` (all 5 green).

**Artifacts now actually contain the evidence** (`image-evidence-39386688001-*`):

```
api/spaartrack-api.tar                  61 656 064
api/spaartrack-api.metadata.json            39 010
api/spaartrack-api.digest.txt                  72
api/spaartrack-api.digest.json                221
```

Before the fix the same artifact was a single 60 821 214-byte tar with no digest
or metadata file.

---

## 4. Promotion evidence — commit SHA → digest → release identity

Digests from the green run `39386688001` (build commit `434764d7`, the PR merge
commit for head `8f4ad50`):

| service | digest | commit SHA | tag |
|---|---|---|---|
| api | `sha256:aa9a2e101600f194365c192235fcd8b6583441408d6e4ec0b4a50d57a1c9c97c` | `434764d7aa231d52b2b79b5fa458c7c4392fe9d8` | `spaartrack/api:434764d7…` |
| web | `sha256:709a1cea51c6c920b631f0e1b7a54ef2e2352c206b099586418662e039de84b2` | `434764d7aa231d52b2b79b5fa458c7c4392fe9d8` | `spaartrack/web:434764d7…` |
| worker | `sha256:ba939c882a4d838b800ef08a9a95cb1f4c3bcae0b9e6232229aa02f7fc94e0be` | `434764d7aa231d52b2b79b5fa458c7c4392fe9d8` | `spaartrack/worker:434764d7…` |

**Cross-check — the four independent evidence sources agree** for every service:
`digest.json` == `metadata.json` (`containerimage.digest`) == the OCI tar's
`index.json` digest == `digest.txt`. All `ALL_MATCH=True`.

**Attestations embedded in each remote image** (verified by extracting the
attestation manifests from the OCI tars):

- `https://spdx.dev/Document` — SBOM, **233 packages** per image;
- `https://slsa.dev/provenance/v1` — provenance whose
  `buildDefinition.externalParameters.request.args` carries
  `VCS_REF=434764d7…`, `APP_VERSION=434764d7…` and `vcs:revision=434764d7…`,
  matching the digest evidence and the OCI `ref.name` annotation.

**Promotion gate** (`infra/release/verify-promotion.sh`) against the real remote
digest: matching digests → `promotion approved`, exit 0; differing digests →
`promotion refused`, exit 1.

**Release identity** — the local Coolify rehearsal
(`infra/coolify/rehearse-development.sh`) was run with the **real remote api
digest** and the real build commit:

```json
{"release":"development","environment":"development","service":"api",
 "commit_sha":"434764d7aa231d52b2b79b5fa458c7c4392fe9d8",
 "image_digest":"sha256:aa9a2e101600f194365c192235fcd8b6583441408d6e4ec0b4a50d57a1c9c97c",
 "migration_version":"schema.sql","deployed_at":"2026-10-20T07:34:02Z",
 "trace_id":"325e7fd2-e99f-47ae-88a5-a81107471ed8",
 "correlation_id":"fc3e120e-de9e-48f9-b34e-56e2c2dcab85"}
```

Independently re-read from `http://localhost:18080/api/v1/release`; all 10/10
Compose services healthy, `/health/ready` → `ready` with database and redis both
`tcp_connection_ok`.

---

## 5. Backup / restore equality (TC-X-006)

Real encrypted backup + isolated restore on the local Compose stack, synthetic
passphrase only:

| | source | restored |
|---|---|---|
| tables | 117 | 117 |
| ledger transactions | 6962 | 6962 |
| ledger entries | 6962 | 6962 |
| ledger entry amount sum | 5021939.822961350200 | 5021939.822961350200 |

The restored amount sum is **exactly equal** to the source, which is the
equality assertion TC-X-006 requires — and which was impossible to demonstrate
before the fix, because the report carried a table count under the name
`row_count`.

Backup artifacts: `postgres-20261020T073557Z.dump.enc` (AES-256-CBC, PBKDF2,
sha256 `e2523f6fae81c5855214f4be0a270fd22549adfff34b2cad84ad0c03238aa232`),
`object-storage-20261020T073557Z.tar.enc` (sha256
`46f0682e18ffdcb6d2c4e687c75c215910fabeaf4e975d2d1b2d58bd83d129bf`),
`retention_days: 30`, checksum verified on restore.

---

## 6. Secret scan

`gitleaks-results.sarif` from run `39386688001`: **0 results** — no leaks. The
scan remains blocking.

---

## 7. What is still blocked, and why

| gate item | status | blocker |
|---|---|---|
| SHA-bound blocking CI | **PROVEN** | — |
| immutable digest + SBOM + provenance | **PROVEN** | — |
| promotion digest equality check | **PROVEN** | — |
| release identity (SHA + digest + migration) | **PROVEN locally** | — |
| backup / isolated restore equality | **PROVEN locally** | — |
| reachable Coolify development deployment | **BLOCKED** | no operator-provided Coolify resource, domain or registry; `spaartrack-dev.local` does not resolve; no deployments exist on the repo |
| bounded remote observability window | **BLOCKED** | needs a real deployed environment to observe |
| rollback rehearsal vs. a real prior release | **BLOCKED** | needs a prior approved image/schema pair to roll back to |
| production release (Poort C) | **BLOCKED by design** | production auth, recovery flow and human release approval absent |

An image rollback is not a database rollback (`AGENTS.md`).

## 8. Operator actions required

1. **Merge PR #2** — it is `MERGEABLE` / `mergeStateStatus: CLEAN` with all five
   checks green. Note `main` currently has **no branch protection**; enabling it
   with required checks on `verify`, `security` and the three `image` jobs would
   make this gate structural rather than procedural.
2. **Provide Coolify development access** — a reachable Coolify development
   resource/domain and the intended registry, via operator-managed secret
   references (never values in chat, Git, artifacts or logs). No production access
   is requested.
3. **Confirm the registry path preserves the digest.** The current workflow
   exports OCI archives rather than pushing to a registry. Promotion must consume
   the exact digest recorded above; a mutable tag is not promotion evidence.
4. **Then, on the merged SHA:** re-run the digest capture, deploy that digest to
   Coolify development, attach `/api/v1/release` with matching SHA/digest/migration,
   run the backup/restore equality against the deployed data, capture the bounded
   observability window, and rehearse the image rollback.

## 9. Commands run (summary)

```
git log --oneline -8; git status --porcelain; git branch -a; git worktree list
git ls-remote --heads origin; gh run list --limit 10
gh run view <run> --json jobs; gh run view --job <id> --log / --log-failed
gh api repos/{owner}/{repo}/actions/runs/<run>/artifacts
gh api repos/gitleaks/gitleaks-action/contents/src/gitleaks.js?ref=v3
gh api repos/docker/build-push-action/contents/action.yml?ref=v6
pnpm install --frozen-lockfile; pnpm lint; pnpm typecheck; pnpm test
pnpm --filter @spaartrack/api build; pnpm --filter @spaartrack/api start
docker buildx build --sbom=true --provenance=mode=max --output type=oci
psql -v ON_ERROR_STOP=1 -f database/schema.sql
gitleaks detect --exit-code=2 --log-opts="--no-merges --first-parent"
sh infra/release/verify-promotion.sh
sh infra/coolify/rehearse-development.sh
bash infra/backup/backup-local.sh; bash infra/backup/restore-local.sh
```

All data synthetic; no provider, bank, model or production credentials used.
