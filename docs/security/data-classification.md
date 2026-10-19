# Dataclassificatie (US-0003, TC-US-0003 / TC-US-0003-A/B)

Alle data is synthetisch in de lokale release; geen productie-PII.

| Domein | Classificatie | Retention | Masking | Toegangsregel |
|---|---|---|---|---|
| user (email, status, rollen) | intern — identificeerbaar | accountlevensduur + soft-delete; grants revoke bij delete | email-hash in logs; nooit volledig in trace | eigen user + sessie-scope; admin alleen via audit |
| account (financial_account, portfolio) | vertrouwelijk — financieel | portfoliolevensduur; archiveren i.p.v. wissen | rekeningnamen deels gemaskeerd in UI | portfolio-role boundary (OWNER/EDITOR/VIEWER/ACCOUNTANT/ADVISOR) |
| transaction (ledger_transaction/entry) | vertrouwelijk — financieel | ledger is append-only; correctie via VOID, nooit fysieke delete | bedragen volledig in API, gemaskeerd in logs | application commands; geen directe ledger-write |
| raw payload (provider/import brondata) | beperkt — bronmateriaal | 30 dagen (backup-retentie), daarna prune; legal hold via soft-delete | checksums i.p.v. inhoud in logs | owner + import-reviewer scope; versleutelde opslag |
| log (request/worker/audit logs) | intern — observeerbaar | 30 dagen; audit_log langer bewaard | redactie van token/secret/API-key/rekeningnummer/beschrijving | SRE-lezen; PII-patronen geredigeerd |

Deletion owner: privacy owner (US-0206 soft-delete/revoke); ledger-historie blijft behouden via correction/void.
