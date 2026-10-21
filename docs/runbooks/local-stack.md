# Runbook: lokale stack

## Gezondheidscontrole

    docker compose ps
    curl --fail http://localhost:18080/health/live
    curl --fail http://localhost:18080/health/ready

`docker compose ps` moet voor `web`, `api`, `worker`, `db`, `redis` en
`object-storage` de status `healthy` tonen.

## Fixture-session runtime-tests

De fixture route vereist een expliciet geprovisioneerde
`SYNTHETIC_FIXTURE_KEY`; de Compose-default is leeg. Zet de waarde voor beide
processen klaar voordat runtime-tests worden gestart:

    cp .env.example .env
    set -a; . ./.env; set +a
    docker compose up -d --build
    STACK_SMOKE=1 pnpm test

Zonder de geëxporteerde variabele falen fixture-session-tests luid met
`SYNTHETIC_FIXTURE_KEY is required for fixture-session tests; run \`cp
.env.example .env\` and export it before running the tests`.

## Logs

    docker compose logs -f api worker

## Herstart

    docker compose restart api worker

## Schone lokale initialisatie

Stop eerst de stack. Verwijder alleen de lokale volumes via docker compose down -v wanneer alle lokale data weg mag. Gebruik dit niet op staging of productie.
