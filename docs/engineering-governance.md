# Engineering governance (v1.0.0)

Status: accepted for contributor workflow. Scope: US-0004 / TC-US-0004. This document supplies operational conventions; it does not change product behavior, financial policy, roadmap priorities, or release gates.

## Authority and scope

`AGENTS.md` is the authoritative, repository-wide source for mandatory agent and development rules. This document explains how contributors satisfy those rules in day-to-day work; it does not replace, weaken, or override them. When a convention here conflicts with `AGENTS.md`, the ADRs, or an approved story/test contract, follow the authoritative rule and raise the inconsistency before implementation. ADR-0001 and ADR-0002 remain the architecture decisions; consult the relevant ADR and `test-cases.md` for each story.

These conventions do not grant permission to change financial policy, make direct SQL writes to the canonical ledger, bypass application services, or alter release gates. A review or merge is not production-release approval.

## Branch convention

Use a lowercase, hyphen-separated branch name containing the exact story ID:

`<type>/<story-id>-<short-description>`

Allowed types are `feat`, `fix`, `docs`, `test`, `refactor`, and `chore`. Example: `feat/us-0004-governance-contract`. For work without a user story, use the tracked issue identifier in the same position and link that issue in the PR. Do not reuse a branch for unrelated stories.

## Commit message convention

Use Conventional Commits with a lowercase type and a concise imperative description:

`<type>(<optional-scope>): <imperative summary>`

Allowed types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `build`, and `ci`. Keep the subject at or below 72 characters. Include the story or issue ID in the commit body or footer when it does not fit naturally in the subject. Example:

`docs(governance): add US-0004 contribution conventions`

Do not include credentials, account data, or other secrets in commit messages.

## Definition of Ready

A work item is ready to implement when all applicable checks are true:

- It names the exact `US-*` story and `TC-US-*` case (or a tracked issue when no story applies), with a verifiable acceptance outcome.
- `roadmap.md`, the relevant ADR, and the linked cases in `test-cases.md` have been read; unresolved product or financial-policy decisions are identified rather than guessed.
- The bounded context and owning application-service boundary are clear. For financial changes, the canonical ledger remains the only financial write boundary; read models, imports, connectors, UI, AI, and agents do not write to it directly.
- The smallest relevant contract, unit, golden, integration, or E2E test is identified and can be written first. Expected negative paths and synthetic fixtures are named where relevant.
- Scope, dependencies, non-goals, observability/audit needs, and likely data or migration impact are stated. Any schema change has an authorized owner and a backward-compatible expand/contract approach; no migration is inferred to be approved merely because work is ready.
- Only synthetic examples and fixtures are needed; no real broker, bank, model, or user secrets are required.

If a required decision or owner approval is missing, the item is not Ready; record the question and obtain the appropriate decision before implementing the affected behavior.

## Definition of Done

A work item is done when all applicable checks are evidenced:

- The change stays within its approved story, bounded context, and non-goals; application-service/event boundaries are preserved.
- A relevant test was added or updated before implementation, observed failing for the intended reason when practicable, then passes. Relevant regression, lint, typecheck, and other required project checks pass; no test is disabled to obtain a pass.
- Financial writes, if any, go only through the authorized canonical-ledger application service. Corrections/void preserve original activity and audit history; physical deletion is not used.
- Schema changes, only when separately authorized, use backward-compatible expand/contract and include the applicable dry-run and restore evidence. A database rollback is never assumed from an image rollback.
- Requests, jobs, imports, provider calls, and agent runs touched by the change retain `TRACE_ID` and `CORRELATION_ID` (serialized as `trace_id` and `correlation_id` where applicable). Logs, fixtures, screenshots, test output, and artifacts contain no real secrets or prohibited personal/financial data.
- Documentation and exact `US-*` / `TC-US-*` traceability are updated when affected. Reviewers can reproduce the commands and inspect the evidence; required independent/security/owner reviews and release gates remain explicit and are not claimed by this checklist.

## Change review

Every pull request uses `.github/PULL_REQUEST_TEMPLATE.md`. Reviewers check story traceability, tests and evidence, scope, security/data handling, and migration impact. Changes to shared architecture, schema, or event contracts require the relevant owner review before dependent work builds against them. Merge/release authorization follows the repository's existing roadmap and test-case gates.
