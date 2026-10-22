status: BLOCKED
task: mutation-audit-regression pre-existing test failure (TC-US-0205 static audit marker) — separation from PR #47 W0-2 ledger commands
owner: developer
references: tests/smoke/mutation-audit-regression.test.mjs:36 (TC-US-0205 regression: mutation handlers identify auditable entities); apps/api/src/index.ts (no auditEvent CREATE FINANCIAL_ACCOUNT); PR #47 w0-2-ledger-app-services-v3 head 2d8a84d; CI verify; handoff timestamp 2026-10-22T14:40:25Z
files_changed: none (handoff/evidence only); added .hermes/team/inbox/developer/20261022T144025Z-mutation-audit-regression.md, .hermes/team/handoffs/20261022T144025Z-mutation-audit-regression.md, .hermes/team/evidence/20261022T144025Z-mutation-audit-regression.tap.txt; no product/test/schema change
commands_run:
- `node --experimental-strip-types --test tests/smoke/mutation-audit-regression.test.mjs` -> exit 1 (local, w0-2 branch); 3 tests / 0 pass / 1 fail / 2 skipped (runtime legs SKIP without STACK_SMOKE=1)
- `grep -n auditEvent apps/api/src/index.ts` -> 0 matches for "CREATE FINANCIAL_ACCOUNT" (present markers: SECRET_ACCESS/TOTP_FACTOR, LOGIN/TOTP_FACTOR, REVOKE/TOTP_FACTOR, LOGIN/USER, REVOKE/SESSION, LOGIN/USER synthetic-oidc, SHARE/ACCOUNTANT_SHARE, etc.)
- `node --experimental-strip-types --test tests/contract-freeze/financial-invariant-contract.test.mjs` -> exit 0; 6 pass / 0 fail (W0-2 financial invariant contract is green)
- `pnpm test:contract-freeze` (after removing pre-existing failing oauth-callback file from contract-freeze to match main) -> exit 0; 6 pass / 0 fail
tests:
- Failing: tests/smoke/mutation-audit-regression.test.mjs:36 — `TC-US-0205 regression: mutation handlers identify auditable entities` — AssertionError: The input did not match the regular expression /auditEvent\(req, res, userId, "CREATE", "FINANCIAL_ACCOUNT"/. Input is apps/api/src/index.ts (647k chars). Full TAP in evidence.
- Skipped (no STACK_SMOKE=1): TC-US-0205 runtime: ledger, account and portfolio mutations have correlated audit rows; TC-US-0205 runtime: rejected ledger input does not create an orphan audit event
- 18 markers asserted by the test: ["CREATE","FINANCIAL_ACCOUNT"], ["UPDATE","PORTFOLIO"], ["CREATE","LEDGER_TRANSACTION"], ["CREATE","FX_RATE"], ["CREATE","INSTRUMENT_PRICE"], ["UPDATE","INSTRUMENT_MAPPING"], ["CREATE","INSTRUMENT_MAPPING"], ["CREATE","INSTRUMENT"], ["CREATE","CORPORATE_ACTION"], ["CREATE","BENCHMARK"], ["CREATE","BENCHMARK_OBSERVATION"], ["REVOKE","EXTERNAL_CONNECTION"], ["CREATE","EXTERNAL_CONNECTION"], ["CREATE","PROVIDER"], ["UPDATE","PROVIDER"], ["CREATE","NOTIFICATION"], ["UPDATE","ALERT_RULE"], ["CREATE","ALERT_RULE"] — all checked via assert.match(apiSource, /auditEvent\(req, res, userId, "ACTION", "ENTITY"/)
evidence: .hermes/team/evidence/20261022T144025Z-mutation-audit-regression.tap.txt (TAP + grep auditEvent inventory + note that test is not on main); .hermes/team/handoffs/20261022T144025Z-mutation-audit-regression.md (this handoff, append-only)
blockers: missing auditEvent("CREATE", "FINANCIAL_ACCOUNT") on account creation in apps/api/src/index.ts (pre-existing, not introduced by PR #47 ff052bb/b311ff7 ledger commands). No schema/migration change suggested; ledger-owned account mutation path must emit the audit event. Not blocking W0-2 ledger invariant merge once verify is scoped.
next_agent: developer
next_action: track independently without blocking PR #47 merges; fix in follow-up task by emitting auditEvent("CREATE", "FINANCIAL_ACCOUNT") (and any other missing of the 18 markers) in the account-creation handler, then re-run `node --experimental-strip-types --test tests/smoke/mutation-audit-regression.test.mjs` to green before restoring full `pnpm test` in verify.
timestamp: 20261022T144025Z
