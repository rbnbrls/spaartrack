# Development workflow

## Bootstrap

    cp .env.example .env
    docker compose up -d --build
    docker compose ps

De standaardopdracht start de volledige lokale Poort A-basis: web, API, worker,
PostgreSQL, Redis en object storage. Er zijn geen cloudcredentials nodig.

De database wordt bij een lege PostgreSQL-volume geïnitialiseerd vanuit database/schema.sql. Voor een schone lokale reset mag alleen de lokale Compose-volume worden verwijderd nadat de fixturedata is veiliggesteld.

## TDD

1. Kies één story- of child-ID uit roadmap.md.
2. Open het corresponderende testgeval in test-cases.md.
3. Voeg eerst de falende test toe aan de juiste testlaag.
4. Implementeer binnen de bounded context.
5. Draai lint, typecheck, unit, contract, integration en relevante E2E-tests.
6. Voeg observability, audit en documentatie toe.
7. Laat de release-gates beoordelen.

## Modulegrenzen

De API exposeert application services. Alleen Ledger post canonical activities. Integrations normaliseren naar candidates en sturen die door review/posting. Read models worden uit ledger/events opgebouwd.
