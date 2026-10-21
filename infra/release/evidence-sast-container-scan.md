# SAST and container-scan release evidence

Status: local contract evidence for the CI gates. No production credentials or provider data are used.

## Main-tip identity

The repository main tip used as the base for this evidence is:

    c615afb003a9c2fca095ac434b546962fd034973

Verified with:

    git rev-parse main

The gate implementation under test is the follow-on CI change in this worktree; the SHA above is the exact landed main tip before this bounded test/evidence change is landed.

## Gate versions and configuration

- Semgrep image: `semgrep/semgrep:1.181.0`; ruleset `p/ci`.
- Semgrep blocking mode: `--error`; SARIF output: `--sarif -o semgrep.sarif`.
- Container scanner: `aquasecurity/trivy-action@v0.36.0`.
- Trivy scan type: `image`, using `spaartrack/<service>:${{ github.sha }}` loaded by the preceding Buildx step (`load: true`).
- Trivy thresholds: `HIGH,CRITICAL`, `exit-code: "1"`, `ignore-unfixed: false`.
- SARIF upload: `github/codeql-action/upload-sarif@v3`, with `semgrep` and per-service `trivy-<service>` categories.
- Workflow coverage: `pull_request` and pushes to `main`.
- The inherited base-image baseline is `.trivyignore.yaml`; each entry has an expiry date and reason.

## Results

| Gate | Synthetic contract assertions | Expected SARIF findings |
|---|---:|---:|
| Semgrep SAST | 2/2 passed | 0 |
| Trivy image scan (web/api/worker contract) | 3/3 passed | 0 |

The counts above are contract-test results and the expected clean SARIF result count for the synthetic configuration. The tests do not embed credentials and do not publish a real scan artifact.

## Blocking behavior proof

The tests assert the blocking controls directly:

- Removing the Semgrep step or either `--error`/SARIF flag makes `ci-workflow-sast-contract.test.mjs` fail.
- Removing the Trivy step, image reference, `HIGH,CRITICAL`, or exit code 1 makes `ci-workflow-container-scan-contract.test.mjs` fail.
- Removing either workflow trigger makes the trigger contract fail.

Commands and results:

    node --test tests/smoke/ci-workflow-sast-contract.test.mjs tests/smoke/ci-workflow-container-scan-contract.test.mjs
    5 tests, 5 pass, 0 fail

The required RED check was run before applying the gate implementation: 4/5 assertions failed (the trigger-only assertion passed). The GREEN check above was run after applying the implementation: 5/5 passed.

Full regression evidence for this bounded change:

    pnpm test

The focused contract tests are the release evidence for this card; a remote GitHub Actions run and its generated SARIF artifact remain a post-landing verification step.
