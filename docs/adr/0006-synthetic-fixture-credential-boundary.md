# ADR-0006: Synthetic fixture credential boundary (US-0201 / US-0202 / TC-US-0201-BOOTSTRAP)

## Status

Accepted. This ADR records the security ruling on the synthetic fixture
credential and the CI/test plumbing that depends on it. It does not change the
`compose.yaml` default that is already shipped fail-closed (`d524e83`), and it
does not change any API behaviour.

## Context

`POST /api/v1/test-fixtures/sessions` is a privileged local test mechanism: it
mints an opaque session for any email, with no authenticator. It is gated in
`apps/api/src/index.ts` by three conditions:

- `environment === "local"` (`apps/api/src/index.ts:427`),
- `authMode === "synthetic"` (same guard),
- a timing-safe comparison of `x-synthetic-fixture-key` against
  `SYNTHETIC_FIXTURE_KEY` from the environment, where an **empty** expected key
  short-circuits to `401 SYNTHETIC_FIXTURE_AUTH_REQUIRED` before the comparison
  (`apps/api/src/index.ts:433-438`).

Three shipped defaults compose against that guard:

| Source | Default when unset |
|---|---|
| `apps/api/src/index.ts:61` — `process.env.APP_ENV \|\| "local"` | `local` |
| `compose.yaml:24` — `APP_ENV: ${APP_ENV:-local}` | `local` |
| `compose.yaml:26` — `APP_AUTH_MODE: ${APP_AUTH_MODE:-synthetic}` | `synthetic` |

So the *environment* half of the guard is satisfied by default. The credential
half is therefore the only thing standing between a misconfigured deployment and
open session issuance, and a **committed fallback key makes that barrier
worthless**: the fallback is published in the repository, so it provides no
secret at all.

The candidate that briefly reached `main` set
`compose.yaml:27` to `SYNTHETIC_FIXTURE_KEY: ${SYNTHETIC_FIXTURE_KEY:-local-test-fixture-only}`.
With all four variables unset, `docker compose config` resolved
`APP_ENV=local`, `APP_AUTH_MODE=synthetic`,
`SYNTHETIC_FIXTURE_KEY=local-test-fixture-only`, which satisfies the route
guard and lets a holder of that published value mint a session for **any**
email. `d524e83` reverted that to the empty, fail-closed default.

This ADR also records the second half of the finding: even with the compose
default fail-closed, the **test suite** still hardcoded the published literal
at 127 call sites in 102 files. The stack and the tests therefore agreed **by
convention, not by construction**, and the literal remained load-bearing and
published.

## Decision

### 1. The compose default stays empty (fail-closed)

`compose.yaml:27` remains `SYNTHETIC_FIXTURE_KEY: ${SYNTHETIC_FIXTURE_KEY:-}`.

The credential is **never** defaulted to a usable value in the deployment file.
A deployment that ships no `.env` resolves the key to the empty string and the
route refuses with `401 SYNTHETIC_FIXTURE_AUTH_REQUIRED`. This is the state
`d524e83` restores, and it is the state this ruling ratifies.

### 2. The credential lives in `.env.example` only

`.env.example:7` carries `SYNTHETIC_FIXTURE_KEY=local-test-fixture-only`. The
documented local bootstrap `cp .env.example .env` (AGENTS.md) therefore still
yields a working local stack, because `docker compose` reads `.env`
automatically and `.env` is gitignored.

The committed value is acceptable to keep for a specific, bounded reason: it is
a **local-only synthetic test credential**, not a production secret. It is
meaningless outside a local synthetic stack because the route refuses unless
`APP_ENV=local` **and** `APP_AUTH_MODE=synthetic`. The risk it carries is the
risk of a *misconfigured* deployment that also inherits `APP_ENV=local`; that is
precisely the composition this ADR keeps fail-closed.

Conditions on the committed value:

- it must never be reintroduced as a `compose.yaml` fallback;
- it must never be used in a non-local environment (the Coolify development
  resource sets `APP_ENV: development`, and no production resource exists);
- any shared or reachable stack must rotate it (`.env.example` says so);
- CI must not use it — see §3.

### 3. The test suite resolves the credential from the environment (Option A)

The published literal stops being load-bearing anywhere. A shared helper
(`tests/helpers/fixture-key.mjs`) resolves `SYNTHETIC_FIXTURE_KEY` from
`process.env` and **fails loudly** when it is unset. It must never fall back to
a hardcoded literal, because a fallback is exactly the published-key problem.

CI generates a **random per-run key** and injects the same value into both the
stack and the test process. The two sides then agree *by construction*.

This is recorded as **Option A** and explicitly **not** Option B (a committed,
CI-scoped literal). Option B was rejected: it puts a usable session-minting
credential back into the repository, which is the property this ADR removes,
and it does not fix the divergence failure mode — the stack and the tests would
still agree by convention.

### 4. The guard test asserts structure, not a literal

The `TC-US-0201-BOOTSTRAP` guard must assert that every fixture-session call
site obtains its credential **through the helper**, and that the compose default
resolves to empty — not that a particular string appears. A literal-matching
guard keeps passing while the stack and the tests disagree, which is precisely
the failure mode that has to be impossible.

`tests/unit/compose-fixture-key-default.test.mjs` is the durable guard for the
compose side: it resolves the interpolation the way compose does and asserts
the resolved value is empty when the variable is not provisioned, cross-checked
against `docker compose config` with no `.env` present.

### 5. The public email-only denial is unchanged and closed

`POST /api/v1/sessions` with only an email keeps answering
`401 AUTHENTICATOR_NOT_CONFIGURED`. The public login route never issues a
session from an email alone. The fixture route's own guard is hardened, never
loosened: `environment === "local" && authMode === "synthetic"` plus the
timing-safe comparison, with an empty expected key refusing outright.

## Residual risk

- **A misconfigured deployment that inherits `APP_ENV=local` and
  `APP_AUTH_MODE=synthetic` and provisions a key has an open fixture route.**
  The credential is the barrier, and the credential is not in the repository
  (compose default empty, `.env` gitignored). This is a defence-in-depth
  residual, not a demonstrated exposure: the Coolify development resource sets
  `APP_ENV: development` so the route is off there regardless of the key, and
  the repository contains no production Coolify resource.
- **The committed `.env.example` value is public.** It is bounded by the local
  guard and by the empty compose default, and it must be rotated for any shared
  stack.
- **The key can still diverge between the stack and the tests** if an operator
  exports a different value into one of the two. The helper resolves from the
  environment on both sides, so the divergence is visible as a
  `401 SYNTHETIC_FIXTURE_AUTH_REQUIRED` rather than a silent success, and CI
  injects one value into both.

## Conditions under which the default may be relaxed

The empty `compose.yaml` default may only be relaxed to a **non-empty,
non-published** value — that is, a value an operator supplies per environment
through the secret store, never a literal committed to the repository. It may
not be relaxed to a committed fallback, in any environment, at any time. Any
change to `compose.yaml:27` requires a fresh security ruling, because the
guard's environment half is satisfied by default and the credential half is the
only remaining barrier.

## Consequences

- The local developer flow is unchanged: `cp .env.example .env` → the key is
  populated → the fixture route works.
- The CI runtime gate becomes runnable **without** a published literal, which
  the previous fail-closed default had made impossible.
- The guard test becomes structural, so it keeps its meaning after a rotation.
- `compose.yaml:27` and this ADR now agree: the fixture route is **off by
  default** and requires an explicitly provisioned credential.

## Non-goals

This ADR does not approve a release or a deployment, does not make Poort B or C
green, does not close TC-X-006/TC-X-007, and does not claim that the synthetic
OIDC adapter is a production identity provider. The production OIDC adapter
remains unimplemented and production startup remains disabled
(`PRODUCTION_OIDC_ADAPTER_UNAVAILABLE`), as recorded in ADR-0004.
