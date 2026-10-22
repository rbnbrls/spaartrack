# QA Evidence — t_d3dec061 Wave 0 behavioural test suite (US-0001..US-0005)

Branch: feat/wave0-behavioural-suite
Head commit: fd17249 (plus uncommitted refinements staged in this run)

## Focused suite (AC #1, #3)

Command:
node --experimental-strip-types --test tests/unit/us0001-bounded-contexts.test.mjs tests/unit/us0002-financial-invariants.test.mjs tests/unit/us0003-data-classification.test.mjs tests/unit/us0004-conventions.test.mjs tests/unit/us0005-threat-model.test.mjs

Result:
ℹ tests 29
ℹ pass 29
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
exit=0

Per-file:
us0001-bounded-contexts: tests 5 pass 5 fail 0
us0002-financial-invariants: tests 8 pass 8 fail 0
us0003-data-classification: tests 5 pass 5 fail 0
us0004-conventions: tests 5 pass 5 fail 0
us0005-threat-model: tests 6 pass 6 fail 0

## Full unit suite

Command:
node --experimental-strip-types --test tests/unit/*.test.mjs

Result (prior run, unchanged): 260/260 pass, 0 skipped, 0 fail.

## Full regression (AC #3)

Command:
STACK_SMOKE=1 npm test

Result: tests 709, pass 701, fail 6, skipped 2.
The 6 failures are unrelated to Wave 0 stories:
- TC-US-0102-B/C release identity (runtime, needs API container + bound identity env)
- TC-US-0203-OIDC-DEPLOY (runtime, needs OIDC adapter)
- TC-US-0205 mutation-audit / runtime audit rows (pre-existing, tracked in inbox)
- oauth callback log redaction (needs API_CONTAINER_NAME env)
- US-0004 governance smoke (needs TRACE_ID/CORRELATION_ID env; passes with them set: 6/6)

With TRACE_ID and CORRELATION_ID exported, the US-0004 smoke passes (6/6).

## Synthetic fixtures exercised

ENV-001, SEC-001, LEDGER-001, CALC-001, UI-001 via tests/helpers/behavioral-fixtures.mjs.
