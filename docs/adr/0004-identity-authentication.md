# ADR-0004: Identity and authentication boundary

## Status
Accepted for the local synthetic adapter; production provider remains disabled pending validation.

## Context
Email addresses are public identifiers, not authenticators. Self-service lifecycle and user reads must be scoped to the authenticated principal. Synthetic identity and OIDC callbacks are for disposable local testing only and must not be represented as a real identity provider.

## Decision
- Identity commands and queries are application boundaries; user self-read and self-lifecycle operations require a valid active session whose principal matches the target user. Admin scope is not inferred from email or request data.
- The explicit `APP_AUTH_MODE` defaults to `disabled`; only an operator's explicit `synthetic` selection enables the local testing adapter. Once a TOTP factor is enrolled, login requires a valid current-window TOTP. An accepted counter is persisted atomically and may only be consumed once; failed attempts are bounded and lock the factor. Synthetic OIDC callback is also an authentication path: it must refuse session issuance when an active TOTP factor is enrolled, because the synthetic callback cannot collect or verify that factor.
- Synthetic OIDC is a local-only test adapter and must never claim provider validation or production OIDC readiness. Real OIDC must be implemented behind a provider adapter with issuer, audience/client, signature, nonce/state, redirect and key-rotation validation. Since no such adapter is present, production startup fails unconditionally with `PRODUCTION_OIDC_ADAPTER_UNAVAILABLE`; environment flags and provider configuration cannot assert validation or enable deployment.
- Existing sessions are valid only while unexpired, unrevoked, and their user remains ACTIVE and not deleted.

## Consequences
- TOTP replay/lockout fields are additive and deployed by an expand migration; rollback means retain nullable/defaulted fields while the prior application ignores them, never downgrade data.
- Local email bootstrap is a fixture convenience, not a production authentication mechanism or a secure public sign-in flow. Synthetic mode must only run on an isolated local test environment; test-fixture session issuance is a separate route requiring an explicitly configured `SYNTHETIC_FIXTURE_KEY`, and the public login route never issues a session from email alone.
- Release evidence for the identity stories must include no-auth, outsider, self, suspension/deletion, TOTP replay/lockout and deployment-mode tests.
- This ADR does not change the canonical ledger or grant any direct database-write capability to read models, imports, connectors, UI, AI or agents.

## Application contract
Production authentication must be provided by a validated OIDC adapter that maps validated `(issuer, subject)` claims to `auth_identity`, then uses the existing session application service. The synthetic `/api/v1/oidc/*` routes are not that adapter; production OIDC callbacks remain unimplemented and disabled until independently validated. A self-asserted `OIDC_PROVIDER_VALIDATED` environment value is not provider validation and is ignored as an authorization to start production. User creation from email is a local fixture bootstrap only. All identity changes are made via application routes and audited; no direct database access is granted to callers.

## Non-goals
This ADR does not claim a production OIDC provider, recovery ceremony, hardware-key support, or approval to deploy Poort C. Those remain release blockers until independently validated.
