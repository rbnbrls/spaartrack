# ADR-0006: Wave 0 test basis and behavioural contract verification

## Status

Accepted

## Context

The independent QA audit (`t_6af8af27`) found that the Wave 0 stories (`US-0001`–`US-0005`) are currently classified as `PARTIAL` because the acceptance evidence is a *static marker assertion*, never a behavioural test. A static marker assertion (e.g. checking that a string `** FEATURE PANEL **` exists in a source file) proves that a marker exists, but does not prove that the feature logic behaves correctly when input is invalid, malformed, or adversarial.

## Decision

1. **Behavioural tests are mandatory for Wave 0.** Each of `US-0001`–`US-0005` must have a behavioural test that fails on invalid implementation logic, not just on missing markers.
2. **Synthetic fixtures are the test data source.** All tests must use the synthetic fixtures (`ENV-001`, `SEC-001`, `LEDGER-001`, `CALC-001`, `UI-001`) defined in `fixtures/`.
3. **Traceability is enforced via `TC-US-*` mapping.** Every `US-*` must map to a `TC-US-*` test, owner, module, and exit criterion. This mapping is asserted in the test files themselves.
4. **Tests are wired into the regression suite.** The behavioural tests must be executable via `pnpm test` and included in the CI `verify` check.
5. **Canonical ledger is the only financial write boundary.** The behavioural tests for Wave 0 must assert that financial writes go through application commands and that no direct SQL writes occur.

## Consequences

- The `PARTIAL` status for `US-0001`–`US-0005` is replaced by `VERIFIED` only when the behavioural tests pass.
- This ADR does not authorize any production release (Poort C) — that gate remains blocked until independent validation.
- The architecture contract tests (`tests/smoke/architecture-contract.test.mjs`) remain the executable boundary enforcement and must be kept green.
- Wave 1+ implementation may not proceed on a story until its Wave 0 behavioural test suite is green.

## Non-goals

This ADR does not claim production readiness, real provider connectivity, or an external Coolify deployment. Those remain blocked pending independent validation under `B-001` and `B-003`.
