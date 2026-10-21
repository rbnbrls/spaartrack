# US-0005 Security Threat Model — v1.0.0

- Status: draft for independent QA; not an implementation approval or production security review.
- Scope: Wave 0, US-0005 / TC-US-0005; documentation contract only.
- Data rule: synthetic identities and evidence only. No credentials, live provider data, or production PII are included.
- Decision basis: ADR-0001 (modular monolith and workers), ADR-0002 (canonical ledger), `roadmap.md` Poort A/B/C gates, `test-cases.md` fixture SEC-001 and TC-US-0005, and recorded local synthetic identity/security reviews referenced below.
- Versioning: v1.0.0; review date 2026-10-18. Update version and review evidence when trust boundaries, auth flows, data handling, deployment or material threats change.

## Scope, status and traceability

This model identifies security-relevant assets, boundaries, threats, controls and remaining risk for the documented Spaartrack design and local synthetic Poort A slice. It maps to US-0005 (“risks visible before implementation”) and TC-US-0005 (“assets, trust boundaries, abuse cases and mitigations for auth, integrations, AI and deployment”). It expands that required coverage to sessions/MFA/OIDC, tenant scoping, secrets, actions/addons, backup/restore, audit and observability.

Evidence labels are deliberately narrow:

- VERIFIED (local synthetic only): behavior or contract explicitly exercised in the referenced synthetic test/review evidence. This is not production verification.
- DOCUMENTED: a design, code contract or roadmap requirement exists, but the behavior is not thereby proven end-to-end.
- NOT VERIFIED: no adequate evidence was supplied or run for the stated environment/property. No implication of safety is made.
- NOT IMPLEMENTED / FUTURE: the capability is not authorized or evidenced as a deployed production control.

The task scope is not to implement security controls, approve releases, or certify compliance. ADR-0001/0002 define architectural direction; they are not security certification. The dependency handoffs approve only bounded local synthetic identity/auth and documentation contracts. Roadmap Poort C explicitly remains a separate gate.

## System context and data flows

```text
User/browser
  -- HTTPS in a real deployment (NOT VERIFIED); local synthetic HTTP in tests --> web/API
API --> Identity & Access application boundary --> PostgreSQL identity/session/audit records
API --> portfolio-scoped application services --> PostgreSQL canonical ledger / domain records
API --> authorized read models and export boundary --> browser/download
API/worker --> integration adapter --> external provider (future/limited local synthetic flows)
API/worker --> Redis jobs --> worker --> domain application services / projections
API/worker --> structured logs/metrics/traces --> observability collector
PostgreSQL + object storage --> backup artifacts --> separate restore target (local rehearsal only)
AI/addon/action execution --> NOT IMPLEMENTED as an approved production surface; future scoped application-service boundary only
```

The canonical financial source is PostgreSQL `ledger_transaction` and `ledger_entry`; projections are rebuildable. Imports, providers, AI and workers must not bypass the application boundary to mutate ledger state. Corrections/voids preserve original activity and audit history. A provider flow should terminate in raw evidence and normalized candidates, explicit review, then an authorized ledger command; provider payloads are untrusted input, not canonical truth.

Primary data classes and paths:

| Data | Sources and destinations | Security consequence |
|---|---|---|
| Identity/contact and account lifecycle | user registration, session/auth boundaries, PostgreSQL, export/delete | Identity enumeration, takeover, unwanted retention, or cross-user disclosure. |
| Session bearer material, TOTP seed, OIDC state/code | browser/API, identity boundary, encrypted/hash-only database records | Replay, theft, secret exposure or session fixation can enable account access. Bearer material and one-time enrollment responses are especially sensitive. |
| Portfolio grants and financial records | authenticated API, portfolio boundary, canonical ledger and read models | Cross-tenant reads/writes can expose or corrupt private financial information. |
| Provider credentials/references and raw payloads | integration adapter, vault reference, object storage/database | Egress, SSRF, credential theft, malicious payloads, overcollection and retention risks. |
| Reports and export bundles | authorized report/export endpoints, browser/download/object storage | Bulk exfiltration and incomplete or over-broad export/deletion. |
| Audit, logs, traces and metrics | API/jobs/providers, collectors and retention stores | Sensitive values may leak through telemetry; missing context impairs investigation. |
| Backup and release artifacts | build/deploy pipeline, registry, backup storage, recovery target | Artifact substitution, backup theft/tampering, or restore into an unsafe environment. |

## Assets and security objectives

1. User identity and account lifecycle: confidentiality and integrity; prevent unauthorized creation, takeover, suspension bypass and deletion reversal.
2. Opaque sessions and authentication factors: confidentiality, unforgeability, expiry and immediate revocation; protect against replay and brute force.
3. Portfolio membership, role grants and tenant boundary: deny access unless server-derived principal and current portfolio/account authorization permit the requested operation.
4. Canonical ledger, raw evidence and derived views: preserve financial integrity and provenance; avoid unauthorized writes, cross-tenant disclosure and silent history deletion.
5. Provider secret references and provider data: least-privilege use, controlled egress, no secret value in application logs/responses, and bounded collection/retention.
6. Export/delete and audit records: authorized, attributable operations; preserve legally/financially required ledger history while honoring account privacy boundaries and communicating limits.
7. AI/addon/action interfaces: no ambient credentials or ledger writes; explicit narrow permissions, human confirmation for consequential actions, audit and revocation.
8. Build, deployment and backup/restore artifacts: provenance, integrity, confidentiality, recoverability and human-controlled promotion.
9. Observability context: retain actor/entity/trace/correlation context needed to investigate without logging raw secrets, bearer tokens, account identifiers or transaction descriptions.

## Trust boundaries

| Boundary | Untrusted side → trusted side | Required enforcement / status |
|---|---|---|
| Internet/browser → web/API | User-supplied headers, body, cookies/bearer and uploads → API | Authentication, validation, TLS, CSRF/origin policy where cookies are used, rate limits and secure headers. Session/auth behavior is locally exercised synthetically; production TLS, edge controls and hardening are NOT VERIFIED. |
| API transport → application service | Route parameters and client claims → server-derived principal/context | Derive actor from verified session; check authorization at every route/service boundary, not by UI hiding. Local self/outsider and role tests provide bounded evidence; comprehensive boundary coverage is NOT VERIFIED. |
| User/portfolio → tenant-owned data | User-controlled portfolio/account identifiers → scoped query/command | Bind every read, write, export and background job to authorized user/grant; deny outsider/revoked scopes. Local synthetic tests cover selected cases; exhaustive endpoint/job isolation is NOT VERIFIED. |
| API/worker → provider/network | Provider response, URL, redirects, DNS, timeouts and secrets → adapter | Allowlist destination/provider, validate TLS and redirects, block private/link-local/metadata targets, limit egress, use timeouts/size limits and scoped vault references. Production egress firewall/SSRF controls and real provider validation are NOT VERIFIED. |
| Application → database/object storage/queue | Application data and job payloads → persistent stores | Least-privilege service roles, parameterized access, tenant-bound job context, encryption/access controls, retention and deletion rules. Production IAM, encryption-at-rest configuration and tenant-bound worker enforcement are NOT VERIFIED. |
| Application → observability | Structured events/context → log, metric and trace backends | Redact before export; restrict access/retention; avoid high-cardinality PII labels. Local synthetic redaction contract exists; production pipeline enforcement and redaction efficacy are NOT VERIFIED. |
| Source/build → registry/deployment | Source, dependencies, build worker and artifacts → deployed services | Protected review, reproducible/pinned dependencies, provenance/SBOM/signatures, immutable digest promotion and least-privilege deployment. Local artifact contracts/rehearsals are documented; remote CI, registry trust, signing/verification and production promotion are NOT VERIFIED. |
| Backup → recovery environment | Backup operators/storage → restore target | Encrypt and authenticate backups, separate keys/access, immutable/offsite retention, isolate restore, verify contents and revoke compromised credentials. Local synthetic backup/restore rehearsal is reported; production recovery and equality are NOT VERIFIED. |
| Future AI/addon/action → application services | Model/plugin output and tool arguments → privileged operations | Treat all output as untrusted; explicit per-tool scopes, policy checks server-side, confirmation, limits, sandbox and audit. Approved production AI/addon/action execution is NOT IMPLEMENTED / NOT VERIFIED. |

## Threat actors

- Anonymous internet attacker: exploits public endpoints, parser/upload behavior, weak auth, rate-limit gaps or misconfiguration.
- Malicious or compromised authenticated user: attempts horizontal/vertical privilege escalation, share/export abuse, IDOR, brute force, or destructive actions against another portfolio.
- Malicious/compromised provider or provider account: returns hostile payloads, redirects, schema changes, replayed records or credential-phishing responses.
- Malicious addon, AI prompt author, model or tool output: induces unauthorized reads, data exfiltration, secret disclosure or ledger/action changes.
- Compromised developer, dependency, build worker, CI identity or deploy credential: inserts or promotes a malicious artifact or steals source/secrets.
- Insider/operator with excessive database, backup, observability or vault privileges: reads or alters sensitive records, suppresses evidence or restores stale/compromised data.
- Opportunistic malware, stolen browser/device session or shared-device user: steals bearer session or one-time enrollment material.
- Accidental operator/configuration error: enables synthetic auth outside tests, exposes a service, misroutes provider egress, over-retains data, or promotes an unvalidated digest.

## Abuse cases, mitigations and residual risks

| ID / abuse case | Impact and threat path | Current control and evidence status | Required mitigation / residual risk |
|---|---|---|---|
| TM-01: forge, steal, replay or brute-force login/session | Account takeover through email-only login, stolen bearer token, weak fixture route, replayed OIDC callback or repeated TOTP guesses. | VERIFIED locally: public email-only session issuance is denied; opaque session token stored as SHA-256 hash; expiry/revoke; TOTP encrypted AES-256-GCM with replay/lockout tests; OIDC state/code hashes and single-use callback; synthetic fixture-session route gated to local mode and explicit key. Focused synthetic reviews t_0604ac35 / t_31bd8537 report 20/20 and 21/21 runtime tests respectively. | No production OIDC provider, recovery flow, managed key, production session revocation or production MFA assurance is evidenced. Enrollment returns TOTP secret once to caller; protect transport and disable response logging. Unify differing invalid-user/not-enrolled responses before public auth to reduce enumeration. Poort C stays BLOCKED. |
| TM-02: bypass a portfolio role or access another tenant | IDOR or stale/revoked grant lets outsider read/write accounts, reports, ledger, audit or export. | VERIFIED locally for selected synthetic scenarios: role boundary for OWNER/EDITOR/VIEWER/ACCOUNTANT/ADVISOR, self/outsider denial, revoked grants and user deletion/session invalidation. Server-side checks, not UI hiding, are the contract. | NOT VERIFIED for every route, query, export, worker/job, cache key and concurrent grant-revoke race. Require centralized authorization tests and per-endpoint tenant-isolation review; prove denied access after revoke across all surfaces. |
| TM-03: exploit account lifecycle or privacy endpoints | Abuse registration/login distinctions, unauthorized export, partial deletion, retained grants, or reauthenticate after soft-delete. | VERIFIED locally: export/delete synthetic flow, `DELETED` soft-delete, session/factor/OIDC/grant revocation, and no physical ledger deletion; audit context is reported by synthetic evidence. | Export currently returns empty ledger/raw-payload/report arrays: export completeness is NOT VERIFIED and must not be represented as complete. Define data inventory, retention/legal-hold behavior, backup expiry and deletion semantics; ensure no residual grants/caches/jobs permit access. |
| TM-04: exfiltrate or inject through provider egress | Compromised provider response, malicious URL/redirect, DNS rebinding, oversized payload or secret in URL/log causes SSRF, data theft or parser compromise. | DOCUMENTED boundary: integrations use adapter/contracts; local synthetic flows use vault references and avoid direct ledger writes. Some synthetic provider and bank consent flows exist; no live provider credential or production request was assessed. | Real provider selection/validation, destination allowlists, DNS/IP/redirect controls, TLS verification, response limits, parser isolation, least-privilege secret retrieval, rate limits and egress firewall are NOT VERIFIED. A vault reference is not proof of vault security. Never send portfolio data unless explicitly required/consented. |
| TM-05: disclose or misuse a secret | Logs, API responses, exception messages, backups, environment variables or support artifacts expose provider credential, TOTP secret, session token or encryption key. | VERIFIED locally: session bearer stored as hash; TOTP seed encrypted; OIDC state/code hashed; synthetic secret-reference test response omits value; log redaction smoke contract covers token/secret/API key/account/description patterns. | Secret management, key rotation/KMS, access review, response/log capture in production, backup key separation, crash-dump protection and complete redaction are NOT VERIFIED. Pattern tests cannot prove all secret forms are masked. Never store raw credentials/tokens/codes in Git or test output. |
| TM-06: misuse future AI/addon/action tools | Prompt injection or malicious extension asks for cross-tenant data, secret access, ledger mutation or external exfiltration. | DOCUMENTED only: roadmap defers AI/addons/actions and requires explicit scopes/controlled action contracts. No production execution control is evidenced. | Capability is NOT IMPLEMENTED / NOT VERIFIED for production. Before enablement require signed/validated manifests, deny-by-default permissions, sandbox/network/filesystem isolation, scoped server-side policy, human confirmation for irreversible/financial actions, spend/time limits, audit and kill switch. Model output is untrusted; no direct DB or secret access. |
| TM-07: compromise artifact or deployment chain | Dependency/build/CI compromise substitutes code, leaks secrets, bypasses review or deploys an unvalidated digest. | DOCUMENTED/local synthetic only: roadmap describes immutable image/SBOM/digest and local rehearsal. No production promotion or remote CI/registry verification is claimed here. | NOT VERIFIED: protected branches/reviews, dependency provenance, signing, reproducible build, CI secret isolation, registry ACL, deploy identity, digest verification and rollback compatibility. Require human gate and exact digest chain; image rollback is not database rollback. |
| TM-08: steal, alter or fail to restore backup | Backup exfiltration or tampering; weak cipher mode or key compromise; failed restore leads to data loss or unsafe access. | VERIFIED only as a reported synthetic local rehearsal: encrypted PostgreSQL/object-storage artifacts, checksums, retention metadata and temporary restore. Roadmap records local evidence using AES-256-CBC and SHA-256 checksums. | CBC plus an adjacent checksum is not authenticated encryption if an attacker can alter both; do not infer authenticity. Production key custody/rotation, independent integrity authentication, immutable/offsite copies, retention enforcement, restore isolation, RPO/RTO and restored-data equality are NOT VERIFIED. Require modern authenticated encryption or separately authenticated signatures/MACs and a production restore drill. |
| TM-09: leak PII/financial detail through telemetry | Raw request bodies, descriptions, account identifiers, bearer material or provider payloads enter logs/traces/metrics and persist broadly. | VERIFIED locally only as a synthetic contract: API/worker carry trace and correlation context; smoke contract checks selected sensitive field patterns and redaction marker. | NOT VERIFIED for production exporters, exception/APM capture, metric labels, sampling, downstream access/retention or all payload shapes. Redact at source, use allowlisted attributes, restrict and expire telemetry, and scan representative synthetic failure paths. Trace/correlation IDs are identifiers, not authorization. |
| TM-10: abuse uploads, import parsing or background jobs | Hostile file/payload exploits parser, exhausts resources, crosses tenant boundary or replays a privileged job. | DOCUMENTED architecture separates raw evidence, normalization/review and ledger application command; local import/provider paths have synthetic tests. | NOT VERIFIED for comprehensive content-type/magic checks, decompression/parser sandbox, quotas, malware scanning, queue ACL, job tenant binding, dedupe/replay and worker service-role least privilege. Enforce limits and validate again at the application boundary. |
| TM-11: evade audit or alter financial history | Privileged actor or compromised service bypasses audit, deletes ledger rows, edits event context, or suppresses evidence. | DOCUMENTED contract: ledger is canonical, corrections/VOID preserve originals, audit includes actor/entity/trace/correlation; selected local audit events tested. | NOT VERIFIED for tamper resistance, audit retention/access segregation, completeness/atomicity under failure, alerting, privileged DB access or all action coverage. Production ledger mutations must remain application-service-only and auditable; no direct agent/connector SQL writes. |
| TM-12: configuration fails open | Synthetic auth/test keys, debug endpoints, permissive CORS, default encryption key or local callback become reachable in a deployment. | VERIFIED locally: production startup fails closed for the reviewed auth configuration; synthetic fixture route is local-mode-only and requires explicit key. | Production deployment configuration and fail-closed behavior across all services are NOT VERIFIED. Validate environment at startup; prohibit synthetic flags/routes/default keys outside isolated tests; test release image configuration and ingress exposure. |

## Evidence status

### VERIFIED — bounded local synthetic evidence only

- Identity/security review handoffs t_0604ac35 and t_31bd8537 report targeted local synthetic runtime suites passing 20/20 and 21/21 with no skips in their stated runs. Coverage described includes self/outsider authorization, email-only denial, TOTP replay/lockout, session expiry/revoke, OIDC replay/TOTP enforcement, soft-delete/revocation and production fail-closed configuration. These are upstream reports, not reruns in this documentation task.
- Session bearer hashing, encrypted TOTP seed, hashed OIDC state/code, audit actor/entity/trace/correlation context, and selected privacy/portfolio role flows have contract/runtime evidence recorded in roadmap.md and the parent handoffs.
- Selected local synthetic backup/restore and observability/redaction contracts are described in roadmap.md; they do not establish production controls or complete coverage.
- The architecture and W0-1 documentation contract have bounded approvals recorded in t_264b3273 and t_e0dd69d3; these approvals do not prove runtime ledger atomicity, production deployment, or this threat model's production adequacy.

### NOT VERIFIED / NOT IMPLEMENTED

- Production identity provider integration, real OIDC validation, account recovery, production key custody/rotation, production session revocation and security operations.
- Exhaustive server-side tenant isolation across every API, background job, export/report, cache, audit endpoint and race condition.
- Export completeness: current export includes empty ledger/raw-payload/report arrays; data inventory and deletion/backup lifecycle are unresolved.
- Production provider validation, network egress restrictions, vault guarantees, real consent/token lifecycle and incident response.
- Approved production AI/addon/action runtime and its isolation/authorization/audit guarantees.
- Remote CI/registry provenance, signed-artifact policy, production deployment and human release approval.
- Production backup retention, authenticated integrity, key recovery, restore drill, RPO/RTO and data equality after restore.
- Production observability redaction/access/retention and security alerting.
- Full production threat review, penetration test, independent production security approval, and Poort C.

## Unresolved decisions and owner gates

| Decision / evidence required | Owner gate | State / exit evidence |
|---|---|---|
| Select and validate production OIDC/MFA provider, recovery policy, login error uniformity, session revoke semantics and managed encryption keys. | Identity/Security + human release owner | OPEN; recovery and real provider validation absent. Poort C prerequisite. |
| Define exhaustive authorization matrix and prove isolation for every API, report/export, job, cache and revoke race. | Security + QA + bounded-context owners | OPEN; local tests cover selected synthetic paths only. |
| Inventory exportable data, populate ledger/raw payload/report export where applicable, define retention/legal holds and backup treatment for soft-deleted users. | Privacy/Security + data owners | OPEN; empty export sections are a known exposure/completeness risk. |
| Approve provider allowlist/egress architecture, SSRF defenses, vault/key lifecycle, consent and incident procedures. | Integrations + Security + operator | OPEN; synthetic adapter behavior is not production provider evidence. |
| Define AI/addon permission schema, sandbox, network policy, confirmation and emergency disable before enabling actions. | AI owner + Security + human approver | NOT IMPLEMENTED; no action authorization is granted by this document. |
| Verify build provenance, SBOM/signature enforcement, registry/deployment credentials, exact-digest promotion and schema compatibility. | Platform/Operations + Security + human release owner | NOT VERIFIED; Poort B/C release evidence required. |
| Replace or supplement CBC/checksum backup scheme with authenticated integrity; define key separation, offsite/immutable retention, RPO/RTO and production restore drill/equality. | Operations + Security + data owner | OPEN; local synthetic rehearsal is not production recovery proof. |
| Validate redaction across actual production log/trace/APM pipelines, access controls, retention and alerting using synthetic negative tests. | Operations + Security | NOT VERIFIED. |
| Obtain independent QA review of this contract test and document; perform separate production threat review and explicit human approval. | Independent QA; then Security/release owner | Draft QA child t_5b022c56 is separate; Poort C and human approval remain BLOCKED. |

## Gate statement

This is a reviewable US-0005 / TC-US-0005 threat-model draft. It does not authorize implementation, external provider use, AI/addon/action enablement, production deployment, or Poort C. Local synthetic controls described here are evidence only for their cited bounded tests. Production authentication/recovery, tenant-isolation completeness, provider egress/secrets, artifact provenance, backup/restore, telemetry and human approval remain NOT VERIFIED or OPEN. Release gate: Poort C BLOCKED until all roadmap.md requirements are independently evidenced and the human release owner approves.

## Evidence and trace context

Documentation-contract check command for this run:

```text
TRACE_ID=us0005-green-trace CORRELATION_ID=us0005-green-corr node --test tests/smoke/security-threat-model-contract.test.mjs
```

The check is a file-content contract test, not runtime security coverage. Synthetic upstream runtime evidence identifiers cited in this document are kanban task IDs t_0604ac35 and t_31bd8537; see their recorded metadata for exact commands/results and limitations. Never copy bearer values, TOTP values, provider credentials, real identities, or unredacted evidence into this document or test output.
