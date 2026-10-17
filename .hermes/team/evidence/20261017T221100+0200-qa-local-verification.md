Spaartrack QA B-005 local verification evidence
Timestamp: 2026-10-17 22:11 CEST (UTC+02)
Owner: qa
Repository path: /Users/ruben/spaartrack
Repository identity: unavailable; `git rev-parse --show-toplevel` returned `fatal: not a git repository`.
Data policy: all executed application runtime tests use repository synthetic fixtures only; no real bank/provider data or credentials were supplied. No product files, tests, schema, roadmap, or backlog were changed.

Gate decision: BLOCKED / NOT GREEN. The documented full check ran and returned exit 1: one current B-004 backlog-refinement contract test fails because its required `docs/backlog/b-004-refinement.md` file is absent. I did not skip, weaken, disable, or bypass it.

Commands and results (current run)
1. `docker compose config --quiet` -> exit 0. Repeated after the test run; PASS.
2. `docker compose build` -> exit 0; API, web, worker images built. Local image IDs/digests from `docker image inspect`:
   - API `sha256:ee00312de6a38fa9787876117d2e2076d609655adf1799475bd50504055dcd4f`
   - web `sha256:bab9673797aa169eee43d204e408388542a34788a48e742f053a3a729863cf8a`
   - worker `sha256:20cc86a0e1f53ef7a830209cacf8cdf37ede2eb918b1c39a8f4e00d10ed16f8e`
   These are local image digests only, not SBOM/registry/Coolify promotion evidence.
3. `node_modules/.bin/tsc --noEmit` -> exit 0. This directly checks the same TypeScript compiler command configured for lint and typecheck, but is not a successful `pnpm lint`/`pnpm typecheck` invocation.
4. `docker run --name spaartrack-qa-pnpm-check-2-20261017 --network spaartrack_default -v /Users/ruben/spaartrack:/workspace:ro -w /workspace -e STACK_SMOKE=1 -e API_URL=http://api:8080 -e WEB_URL=http://web -e S3_ENDPOINT=http://object-storage:9000 node:22-alpine sh -lc 'corepack enable && corepack prepare pnpm@9.15.5 --activate && pnpm --version && pnpm check'` -> exit 1. It verified pnpm 9.15.5, ran lint and typecheck successfully, then tests failed. Exact TAP summary: `# tests 169`, `# pass 168`, `# fail 1`, `# cancelled 0`, `# skipped 0`, `# todo 0`, `# duration_ms 3106.586002`.
   - Failed: `B-004 refinement covers all remaining parent stories and executable traceability` (`tests/smoke/backlog-refinement-contract.test.mjs:25`), error `ENOENT: no such file or directory, open '/workspace/docs/backlog/b-004-refinement.md'`.
   - Full TAP transcript: `.hermes/team/evidence/20261017T221000+0200-qa-pnpm-check.tap.txt` (1055 lines). A separate direct Node test invocation against the same Compose dependencies confirmed the same failure; output is `.hermes/team/evidence/20261017T220800+0200-qa-smoke.tap.txt` (1035 lines), 168 pass / 1 fail / 0 skipped.
   - The initial attempt using `corepack pnpm@9.15.5 check` failed because the script's nested `pnpm` command was not on PATH; rerun above enabled Corepack correctly. Initial host `pnpm` invocation was unavailable (`pnpm: command not found`). No test bypass used.
5. `docker compose ps` after checks -> API, DB, Redis, web, object-storage, and worker report `(healthy)`; Grafana, Prometheus and OTel collector report `Up` (no health status declared in compose). Exact output was captured by the terminal tool; stack remained available.
6. `curl --fail --silent --show-error http://localhost:18080/health/live` -> HTTP 200, JSON `status=ok`.
7. `curl --fail --silent --show-error http://localhost:18080/health/ready` -> HTTP 200, JSON `status=ready`, database and redis `ready`, reason `tcp_connection_ok`.
8. `curl --fail --silent --show-error --output /dev/null --write-out 'web HTTP %{http_code}\n' http://localhost:3000/` -> `web HTTP 200`. `curl --include http://localhost:3000/health/ready` -> HTTP 200, body `ready`.
9. `curl --include --header 'x-trace-id: qa-smoke-trace-20261017' --header 'x-correlation-id: qa-smoke-correlation-20261017' http://localhost:18080/health/live` -> HTTP 200; response echoed exactly `x-trace-id: qa-smoke-trace-20261017` and `x-correlation-id: qa-smoke-correlation-20261017`.
10. `curl --include http://localhost:18080/api/v1/release` -> HTTP 200; payload reports release/environment `local`, `commit_sha=local`, `image_digest=local`, `migration_version=schema.sql`, deployed_at `2026-10-17T19:53:12.773Z`. This is explicitly not immutable commit/release evidence.
11. `docker compose exec -T db psql -U spaartrack -d spaartrack -Atc "SELECT current_database(), count(*) FROM information_schema.tables WHERE table_schema='spaartrack';"` -> `spaartrack|104`; schema exists, 104 tables at the time of query. No migration was applied or altered in this QA run.
12. `find tests/smoke -maxdepth 1 -name '*.test.mjs' | wc -l` -> 82 test files. `find database/migrations -maxdepth 1 -name '*.sql' | sort | wc -l` -> 16 standalone SQL migration files (0002–0017). These were inventory counts; migration expand/idempotency behavior was not rerun as part of this read-only QA run.
13. `docker compose logs --since=10m --no-color api worker db redis object-storage web | grep -Eai '(^|[^[:alpha:]])(error|fatal|exception|failed|panic|unhealthy|oom)([^[:alpha:]]|$)'` -> no matching lines (0).
14. `docker compose logs --since=10m --no-color api worker db redis object-storage web | grep -Eai '(password|passwd|secret|token|api[_-]?key|authorization|account[_-]?(number|no)|\bcvc\b)'` -> no matching lines (0). This was a text-pattern scan, not proof of a general secret scanner.
15. `git -C /Users/ruben/spaartrack rev-parse --show-toplevel` and earlier `git status`/`rev-parse HEAD` -> not a Git repository; SHA/branch/diff cannot be verified.

Synthetic data / runtime scope
- `STACK_SMOKE=1`, API `http://api:8080`, web `http://web`, RustFS `http://object-storage:9000`; runtime tests reached live local Compose stack.
- Suite includes repository synthetic fixtures/contracts such as `CALC-001`, `PERF-001`, `BANK-001`, `PROVIDER-001`, `UI-001`, and runtime-created synthetic users/accounts/transactions. Test results are current as of this run only.
- The TAP log does not surface test-run trace/correlation IDs. Direct API health probe returned its own trace `f18d7698-3890-45f4-b716-76e4b4eac594`, correlation `01a4d5bf-1048-4468-bf7a-17e8c0911c14`; separate user-supplied propagation probe preserved trace `qa-smoke-trace-20261017`, correlation `qa-smoke-correlation-20261017`. Do not attribute those health IDs to individual financial tests.
- No live interactive browser/E2E was run this session; prior roadmap browser claims are historical and not represented as current evidence.
- Backup/restore scripts and migration idempotency were inspected but not executed in this QA run; the full suite's backup tests are contract/static cases, not a fresh restore rehearsal.

Blocker and next action
- Keep B-005/local release verification BLOCKED. Orchestrator/architecture must resolve whether to add the missing B-004 refinement artifact in its bounded task or revise the B-004 test contract by proper test-first agreement; QA must not fabricate the file or change/bypass the test under this task.
- Re-run the exact pinned `pnpm check` only after the upstream owner supplies the required artifact and the remaining gates are ready. Poort B still lacks verified external Coolify deployment, remote CI/registry promotion, and deployment evidence; local Compose success does not satisfy Gate B.

