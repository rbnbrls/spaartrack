.PHONY: up down logs check test db-validate

up:
	scripts/dev/compose.sh up -d --build

down:
	scripts/dev/compose.sh down

logs:
	scripts/dev/compose.sh logs -f

check:
	pnpm check

test:
	pnpm test

db-validate:
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
