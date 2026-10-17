# Hermes team communication protocol

Project: `/Users/ruben/spaartrack`

## Shared files

- `backlog.md`: operational queue; roadmap remains the source of truth.
- `.hermes/team/handoffs/`: append-only handoff reports.
- `.hermes/team/inbox/<agent>/`: direct task messages for an agent.
- `.hermes/team/evidence/`: command output, test summaries, and release evidence.
- `.hermes/team/status/`: current agent status snapshots.

## Active handoff loop

1. `orchestrator` reads `backlog.md`, claims one task, and writes a task brief to the owner's inbox.
2. The owner reads its inbox, writes `CLAIMED`, and works only inside its bounded context.
3. The owner writes a timestamped handoff with real command/test output.
4. The owner names the next agent and writes a direct message into that agent's inbox.
5. The receiving agent acknowledges the handoff and continues only when dependencies and gates are green.
6. `orchestrator` reviews the evidence and updates `backlog.md` status/ownership.

## Concurrency rules

- Never have two agents edit the same canonical schema/migration or shared contract concurrently.
- `ledger` is the exclusive owner of canonical ledger schema/migrations.
- If a task requires a shared contract change, stop and hand it to `architecture` before implementation.
- Agents may communicate by text files without waiting for live Bot Chat delivery.
- Do not overwrite handoffs or inbox messages from another agent.
- A blocked task must include the exact missing prerequisite; do not guess or fabricate external access.

## Required handoff fields

`status`, `task`, `owner`, `references`, `files_changed`, `commands_run`, `tests`, `evidence`, `blockers`, `next_agent`, `next_action`, `timestamp`.
