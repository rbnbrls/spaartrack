# Runbook: lokale stack

## Gezondheidscontrole

    docker compose ps
    curl --fail http://localhost:18080/health/live
    curl --fail http://localhost:18080/health/ready

De standaard stack gebruikt projectnaam `spaartrack` en poorten `18080` (API),
`55432` (database), `3000` (web) en `19000` (object storage). Voor een linked
worktree gebruik je uitsluitend `scripts/dev/worktree-compose.sh`; die gebruikt
een eigen projectnaam en de alternatieve poorten `18090`, `55450`, `30050` en
`19050`, zodat beide stacks gelijktijdig kunnen draaien.

`docker compose ps` moet voor `web`, `api`, `worker`, `db`, `redis` en
`object-storage` de status `healthy` tonen.

## Logs

    docker compose logs -f api worker

## Herstart

    docker compose restart api worker

## Schone lokale initialisatie

Stop eerst de stack. Verwijder alleen de lokale volumes via docker compose down -v wanneer alle lokale data weg mag. Gebruik dit niet op staging of productie.
