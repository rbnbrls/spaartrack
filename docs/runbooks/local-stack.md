# Runbook: lokale stack

## Gezondheidscontrole

    docker compose ps
    curl --fail http://localhost:18080/health/live
    curl --fail http://localhost:18080/health/ready

`docker compose ps` moet voor `web`, `api`, `worker`, `db`, `redis` en
`object-storage` de status `healthy` tonen.

## Logs

    docker compose logs -f api worker

## Herstart

    docker compose restart api worker

## Schone lokale initialisatie

Stop eerst de stack. Verwijder alleen de lokale volumes via docker compose down -v wanneer alle lokale data weg mag. Gebruik dit niet op staging of productie.
