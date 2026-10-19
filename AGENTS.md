# Spaartrack agent- en ontwikkelregels

Spaartrack is een private portfolio-, dividend- en Money Flow-app. De canonical financiële bron is de ledger in PostgreSQL. Read models, imports, connectors, AI en agents mogen de ledger nooit rechtstreeks muteren.

## Werkafspraken

1. Lees roadmap.md, de relevante ADR en de gekoppelde testgevallen in test-cases.md.
2. Werk test-first: voeg eerst een falende unit-, contract-, golden- of E2E-test toe.
3. Gebruik alleen synthetische fixtures. Zet nooit broker-, bank- of modelcredentials in Git.
4. Houd bounded contexts gescheiden: application services en events zijn de modulegrens.
5. Schemawijzigingen zijn expand/contract, backward compatible en voorzien van dry-run/restore bewijs.
6. Elke externe provider gaat via packages/integration-contracts en een adapter.
7. Elke request, job, import, provider call en agent-run krijgt trace- en correlation-ID.
8. Een web-facing release vereist de gates uit roadmap.md en test-cases.md.

## Niet toegestaan

- Directe production SQL-mutaties door agents of connectors.
- Echte secrets in fixtures, logs, screenshots, testoutput of CI-artifacts.
- Fysiek verwijderen van ledgeractiviteiten; gebruik correction/void en audit.
- Tests uitschakelen om een release groen te maken.
- Een database rollback aannemen als gevolg van een image rollback.

## Branch- en commitconventies (US-0004, TC-US-0004)

- Branches: `feat/<US-id>-korte-naam`, `fix/<issue>-korte-naam`; één bounded context per branch.
- Commits: `<type>(<US-id>): <omschrijving>` met types `feat|fix|test|chore|docs`; bounded, atomic commits.
- Iedere PR refereert `US-*` en `TC-US-*`; zonder traceability geen merge.

## Definition of Ready

- User story met acceptatiecriteria in roadmap.md; gekoppelde `TC-US-*` in test-cases.md.
- Bounded context + owner bekend; geen open upstream gate-blocker.

## Definition of Done

- Rode `TC-US-*`-test eerst, daarna groen; regressie groen; `tsc`/lint groen.
- Evidence (testtelling, health, logscan) gelogd in roadmap.md; alleen synthetische data.

## Lokale commando's

    cp .env.example .env
    docker compose up -d
    docker compose ps
    docker compose logs -f api
    docker compose down

De lokale stack gebruikt uitsluitend synthetische data. Zie docs/development.md en docs/runbooks/local-stack.md.
