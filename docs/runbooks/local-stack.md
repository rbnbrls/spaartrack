# Runbook: lokale stack

## Gezondheidscontrole

    scripts/dev/stack.sh ps
    scripts/dev/stack.sh config
    curl --fail http://localhost:18080/health/live
    curl --fail http://localhost:18080/health/ready

`docker compose ps` moet voor `web`, `api`, `worker`, `db`, `redis` en
`object-storage` de status `healthy` tonen.

## Worktree-isolatie

Start vanuit een git-worktree uitsluitend met:

    scripts/dev/stack.sh up

De helper gebruikt een projectnaam als `spaartrack-<worktree>` en een
deterministische set afwijkende poorten voor API, PostgreSQL, Redis, web,
object storage en observability. De uitvoer is de bron voor de exacte
`API_URL`, `DATABASE_URL`, `REDIS_URL` en `WEB_URL` van die stack. Alle
lifecycle-acties gebruiken dezelfde projectnaam; `reset` verwijdert alleen de
volumes van die stack. De primaire projectnaam `spaartrack` wordt vanuit een
worktree geweigerd.

## Logs

    scripts/dev/stack.sh ps
    docker compose logs -f api worker

## Herstart

    docker compose restart api worker

## Schone lokale initialisatie

Stop eerst de stack. Gebruik vanuit een worktree `scripts/dev/stack.sh reset`;
dit verwijdert alleen de lokale volumes van die geïsoleerde stack. Gebruik dit
niet op staging of productie.
