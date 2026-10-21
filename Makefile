.PHONY: up down logs check test db-validate

up:
	scripts/dev/stack.sh up

down:
	scripts/dev/stack.sh down

logs:
	docker compose logs -f

check:
	pnpm check

test:
	pnpm test

db-validate:
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
