# Threat model (US-0005, TC-US-0005 / TC-US-0005-A/B)

Alle data is synthetisch in de lokale release; geen productie-PII, geen echte providercredentials.

## Assets

| Asset | Waarde | Bewaarplaats |
|---|---|---|
| canonical ledger (ledger_transaction/entry) | financiële grondwaarheid | PostgreSQL, append-only |
| user identity (sessions, TOTP, OIDC-state) | toegangscontrole | PostgreSQL, gehasht/encrypted |
| raw payloads (import/provider brondata) | reconstrueerbaarheid | object storage, versleuteld |
| backups (postgres + object-storage dumps) | herstel | versleutelde artifacts, AES-256-CBC |
| audit_log | bewijsvoering | PostgreSQL, alleen append |

## Trust boundaries

| Grens | Scheidt | Afdwinging |
|---|---|---|
| web → API | anoniem vs authenticated | opaque bearer-sessie, portfolio-role check |
| application service → ledger | read model vs write boundary | alleen application commands; geen directe SQL-write |
| adapter → provider | intern vs extern | integration-contracts + read-only adapter, secrets via vault-referentie |
| AI/addon → data | agent vs scope | MCP-scopes, Confirm/Cancel, sandbox-isolatie |

## Abuse cases

| # | Abuse case | Domein |
|---|---|---|
| A1 | sessie-replay na logout | auth |
| A2 | ledger-write buiten application service om | deployment/integriteit |
| A3 | provider-secret in fixture, log of image | integrations |
| A4 | AI-mutatie zonder Confirm | AI |
| A5 | backup-restore overschrijft ledger-historie | deployment |
| A6 | cross-tenant portfolio-lees via gemanipuleerde ID | auth |

## Mitigaties

| Abuse | Mitigatie | Evidence |
|---|---|---|
| A1 | SHA-256 token_hash, expiry, revoke; replay-test | TC-US-0202, TC-US-0203-B |
| A2 | ledger alleen via commands; correction/void + audit | TC-US-0305, TC-US-0308 |
| A3 | secret-scan in fixtures; vault-referenties; geen secrets in Git | ISSUE-05/06, TC-US-0102-A |
| A4 | proposal-diff + Confirm/Cancel + audit trail | TC-US-1603/1604 |
| A5 | restore naar tijdelijke DB/sandbox; image rollback ≠ DB rollback | TC-US-0107-B/C |
| A6 | server-side portfolio-role boundary (OWNER/EDITOR/VIEWER/ACCOUNTANT/ADVISOR) | TC-US-0204, TC-US-0301–0308 runtime |

Mitigatie-owner: security owner; review bij elke release-gate (Poort A/B/C).
