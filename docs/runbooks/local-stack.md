# Runbook: lokale stack

## Gezondheidscontrole

    scripts/dev/compose.sh ps
    curl --fail http://localhost:18080/health/live
    curl --fail http://localhost:18080/health/ready

`docker compose ps` moet voor `web`, `api`, `worker`, `db`, `redis` en
`object-storage` de status `healthy` tonen.

## Logs

    scripts/dev/compose.sh logs -f api worker

## Herstart

    scripts/dev/compose.sh restart api worker

## Schone lokale initialisatie

Stop eerst de stack. Verwijder alleen de lokale volumes via scripts/dev/compose.sh down -v wanneer alle lokale data weg mag. Gebruik dit niet op staging of productie.

De wrapper kiest `spaartrack` en de standaardpoorten (18080, 55432, 3000,
19000) voor de standaard checkout. In een git-worktree gebruikt hij de
worktree-directory als Compose-projectnaam en een deterministische, unieke
poortset. Gebruik de wrapper voor iedere lokale Compose-opdracht, zodat
worktrees elkaar niet kunnen vervangen.
