.PHONY: up down logs check test db-validate

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

check:
	pnpm check

test:
	pnpm test

db-validate:
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
