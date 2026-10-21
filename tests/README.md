# Testlagen

De testsuite draait met `node --experimental-strip-types --test tests/unit/*.test.mjs tests/smoke/*.test.mjs`
(equivalent: `pnpm test`, of `make test`). `pnpm check` draait daarnaast `pnpm lint` en
`pnpm typecheck` (`tsc --noEmit`); `make check` is het equivalent daarvan.

De laag `tests/contract-freeze/` draait bewust **niet** mee in de standaard-suite: de
contracten daar zijn RED by design tot de domeineigenaren hun openstaande
financiële beslissingen hebben vastgelegd, of release-gate-contracten waarvan de
implementatie nog niet op main staat. Die laag draait op een eigen commando
(`pnpm test:contract-freeze`), zodat de regressie-gate van de andere stories groen
blijft.

Tests die een draaiende stack nodig hebben (PostgreSQL, Redis, object storage, API)
staan achter `STACK_SMOKE=1` en worden zonder die variabele overgeslagen.

## Actuele mappen

- `tests/unit/` — pure domeinregels, de calculation engine en de UX/UI-contracten;
- `tests/smoke/` — provider-, API-, addon- en golden-contracten plus de stack-tests;
- `tests/runtime/` — executable runtime tests die een gebouwde image en Docker benodigen;
- `tests/helpers/` — gedeelde testhelpers (bijvoorbeeld `tests/helpers/web-source.mjs`);
- `tests/support/` — gedeelde suite-infrastructuur, waaronder de expliciete lokale endpoint-resolver;
- `tests/fixtures/` — synthetische hulpmiddelen voor de smoke-tests (bijvoorbeeld de
  Trading212 GUI-harness);
- `tests/contract-freeze/` — de financiële invariantencontracten van Wave 0
  (US-0002-A/B/C) en release-gatecontracten waarvan de implementatie nog niet
  op main staat. Deze laag is RED by design en draait op `pnpm test:contract-freeze`,
  buiten de standaard-suite om.

De versieerbare fixturepacks staan in de repo-rootmap `fixtures/` (bijvoorbeeld
`fixtures/CALC-001.json`), niet onder `tests/`.

## Vervangen mappen

Een eerdere versie van dit bestand noemde vier mappen die niet (meer) in de boom
bestaan. Hun dekking is verplaatst; onderstaande tabel is de leidende kaart.

| oud pad | huidige dekking |
| --- | --- |
| `contract/` | `tests/smoke/` — bijvoorbeeld `tests/smoke/provider-registry-contract.test.mjs`, `tests/smoke/provider-sync-failure-contract.test.mjs`, `tests/smoke/addon-sdk-contract.test.mjs`, `tests/smoke/addon-sandbox-contract.test.mjs` |
| `integration/` | `tests/smoke/` — bijvoorbeeld `tests/smoke/local-stack.test.mjs`, `tests/smoke/object-storage.test.mjs`, `tests/smoke/health.test.mjs`, `tests/smoke/backup-restore-contract.test.mjs` |
| `e2e/` | `tests/smoke/` voor de GUI- en responsiviteitscontracten (`tests/smoke/gui-shell-contract.test.mjs`, `tests/smoke/pwa-responsive-contract.test.mjs`) en `tests/unit/` voor de UX-journeys (`tests/unit/*-ux.test.mjs`) |
| `financial-golden/` | `tests/smoke/financial-golden-contract.test.mjs` (golden-kernel CALC-001) aangevuld met `tests/smoke/ledger-replay-contract.test.mjs` en `tests/smoke/performance-comparison-contract.test.mjs` |

**Bevinding:** er bestaat geen afzonderlijke `financial-golden/`-pack. De
deterministische ledger-, performance-, dividend-, FX- en Money Flow-cases zijn
verspreid over de hierboven genoemde contracttests; de gouden kernel-fixture zelf is
`fixtures/CALC-001.json`. Een eigen golden-pack is dus een openstaande wens, geen
bestaande map.

De volledige story-traceability staat in `test-cases.md`.
