# Runbook: incident response

1. Open een incident met severity, service, environment, release en correlation ID.
2. Verzamel redacted logs, traces, metrics, deployment metadata, migration result en runbook.
3. Stop promotie; wijzig geen ledgerdata handmatig.
4. Reproduceer met synthetische fixtures en voeg eerst een regression test toe.
5. Laat security en test verification onafhankelijk beoordelen.
6. Deploy uitsluitend een immutable, geverifieerd artifact.
7. Observeer de health window en sluit pas met root cause, impact, timeline, fix, test en prevention item.
