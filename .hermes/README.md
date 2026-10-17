# Hermes project contract

Deze map bevat de lokale Hermes-agentcontracten uit roadmap.md. Agents leveren versioned artefacts via issues, PR's, testreports, release candidates en incident records.

Autonomiegrenzen:

- read: repository, sanitized diagnostics, logs, traces, metrics;
- propose: issue, patch, test, migration plan, alert tuning;
- execute-sandbox: branch, preview, staging en fake providers;
- execute-production-safe: beperkte allowlisted acties;
- execute-production-change: alleen Release Agent via policy en health gates.

Geen agent krijgt raw secrets, arbitrary production SQL of directe ledger-write toegang.
