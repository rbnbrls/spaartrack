# ADR-0001: modulaire monoliet met asynchrone workers

## Status

Accepted

## Besluit

Spaartrack gebruikt één repository en één transactionele PostgreSQL-database met harde modulegrenzen. Imports, broker-sync, marktdata, rapportages, notificaties en agentjobs draaien in workers.

## Consequenties

- financiële invariants blijven transactioneel controleerbaar;
- vroege operationele complexiteit van microservices wordt vermeden;
- modules spreken via application services/events en niet via elkaars tabellen;
- horizontale schaal kan later per worker type worden toegevoegd.
