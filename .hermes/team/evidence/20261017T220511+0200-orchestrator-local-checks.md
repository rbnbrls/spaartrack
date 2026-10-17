# Evidence — current local queue checks (orchestrator observation)

timestamp: 20261017T220511+0200
owner: orchestrator (coordination-only checks)
status: BLOCKED
synthetic_data: no new financial fixture created or mutated
trace_id/correlation_id: live API health checks returned trace_id 5a06f653-9e9b-4604-a1b5-fe5aa764165f, correlation_id d99dc424-e093-4009-b780-7a931e6f1e03; readiness returned trace_id 0d2fcb4a-c803-493b-966c-7a7044901409, correlation_id bd64bc1a-cc7a-4331-b7d3-86a532e124e1; release read returned trace_id 040d88da-32fd-4bfa-b2f6-ebf9a86e64e8, correlation_id 58f7c80d-0778-47ba-a493-629612cf305d.

commands and exact outcomes:
- `git status --short --branch && git log -5 --oneline` in /Users/ruben/spaartrack: `fatal: not a git repository (or any of the parent directories): .git`, exit 128. No commit SHA can be verified from local Git metadata.
- `pnpm --version && docker compose ps`: `/bin/bash: line 4: pnpm: command not found`, exit 127. Since `&&` short-circuited, that command did not run compose ps.
- `docker compose ps`: exit 0. API, DB, Redis, web, worker, object-storage, Grafana, OTel collector, Prometheus all listed Up; API, DB, Redis, web, worker and object-storage listed healthy. This is local runtime evidence only.
- `./node_modules/.bin/tsc --noEmit`: exit 0, no output.
- `node --test tests/smoke/*.test.mjs`: exit 1; summary `tests 169`, `pass 98`, `fail 1`, `cancelled 0`, `skipped 70`, `todo 0`. Failing test: `B-004 refinement covers all remaining parent stories and executable traceability`; `tests/smoke/backlog-refinement-contract.test.mjs:25`; ENOENT for `/Users/ruben/spaartrack/docs/backlog/b-004-refinement.md`. No tests were modified or bypassed. Runtime cases were skipped by the test harness without STACK_SMOKE=1; no runtime financial fixture was run by this command.
- `curl --fail --silent --show-error -i http://localhost:18080/health/live`: HTTP 200 `status=ok`, service api, local release.
- `curl --fail --silent --show-error -i http://localhost:18080/health/ready`: HTTP 200 `status=ready`, database and redis ready (`tcp_connection_ok`).
- `curl --fail --silent --show-error http://localhost:18080/api/v1/release`: returned local metadata only: `commit_sha=local`, `image_digest=local`, `migration_version=schema.sql`; not an immutable artifact or remote deployment.
- `./infra/release/verify-promotion.sh` without inputs: exit 1, `DEVELOPMENT_DIGEST is required`; no promotion was attempted.
- `./infra/coolify/rehearse-development.sh` without inputs: exit 1, `COOLIFY_COMMIT_SHA is required`; no rehearsal/deployment was attempted.
- `docker compose logs --since=5m api worker | grep -E -i 'error|fatal|exception|failed|panic|unhealthy|oom' || true`: exit 0, no matched lines. The `|| true` here is a diagnostic pipeline only; it is not test evidence and cannot turn a failed test green.

blockers:
1. B-004 smoke contract fails because the expected artifact `docs/backlog/b-004-refinement.md` is absent; architecture owner must supply planning artifact or QA rerun after it lands.
2. `pnpm` is not on PATH; `pnpm check` could not run as documented. TypeScript and raw Node smoke tests were run separately; they do not substitute for a full passing check.
3. No `.git` metadata, so current source SHA/commit association cannot be verified.
4. Current API release endpoint is explicitly local (`commit_sha=local`, `image_digest=local`). No real Coolify/registry/remote-CI/deployment evidence was accessed. Poort B remains open.
5. No agents have yet written owner handoffs/CLAIMED messages in this session; coordination dispatches are present, work is awaiting agent response.
