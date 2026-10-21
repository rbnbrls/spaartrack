## Story

- Story-ID: `US-____` (or linked issue):
- Test-ID: `TC-US-____` (or explain why not applicable):
- Scope and explicit non-goals:
- Owning bounded context/application service:

## TDD evidence

- [ ] Falende test eerst toegevoegd; focused command/result:
- [ ] Unit/integration/contract/golden/E2E-tests groen; commands/results:
- [ ] Financial invariants en replay gecontroleerd waar relevant:
- [ ] Observability and audit evidence; TRACE_ID/CORRELATION_ID where applicable:
- [ ] Migration/backup/restore impact assessed; link dry-run/restore evidence if authorized:
- [ ] Security/privacy review and synthetic-fixture check:
- [ ] `git diff --check` clean:

## Release impact

- [ ] No production credentials or real personal/financial data used
- [ ] No direct ledger-write outside the authorized canonical Ledger boundary
- [ ] Corrections/void preserve original activity and audit; no physical ledger deletion
- [ ] Image rollback is not assumed to roll back database state
- [ ] Existing roadmap/test-case release gates and status stated; merge is not release approval

## Reviewer notes

<!-- List risks, decisions needed, owner reviews, and evidence that remains NOT VERIFIED. -->
