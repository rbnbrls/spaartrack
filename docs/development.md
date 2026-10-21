# Development workflow

## Bootstrap

    cp .env.example .env
    scripts/dev/compose.sh up -d --build
    scripts/dev/compose.sh ps

De standaardopdracht start de volledige lokale Poort A-basis: web, API, worker,
PostgreSQL, Redis en object storage. Er zijn geen cloudcredentials nodig.

De database wordt bij een lege PostgreSQL-volume geïnitialiseerd vanuit database/schema.sql. Voor een schone lokale reset mag alleen de lokale Compose-volume worden verwijderd nadat de fixturedata is veiliggesteld.

## Geïsoleerde worktrees (git worktree)

`git worktree add` maakt een checkout **zonder** `node_modules/` — die map is
gitignored (`.gitignore:5`). Dit project is een pnpm-workspace: `pg` en
`@types/pg` worden door `apps/api/package.json` gedeclareerd en staan daardoor
onder `apps/api/node_modules/`, niet in de root-`node_modules/`.

Een niet-geprovisioneerde worktree meldt daardoor een **vals RODE gate**:

    apps/api/src/index.ts(5,22): error TS2307: Cannot find module 'pg' or its
                             corresponding type declarations.
    apps/api/src/index.ts(1996,45): error TS7006: Parameter 'candidate' implicitly
                             has an 'any' type.
    ... 75x TS7006, 4x TS2339, 3x TS2345, 4x TS2307

De `TS2307` op `pg` **cascadet**: zonder de `pg`-types verliest elk
`pool.query`-callbackparameter zijn afgeleide type en wordt het `implicitly any`.
Die foutregels zijn **één ontbrekende dependency-link, geen source-defecten**.

Gemeten op een verse worktree met alleen de root-`node_modules` gesymlinkt
(88 → 86 regels op `main` HEAD `366bd0f`):

    75x TS7006, 4x TS2339, 3x TS2345, 4x TS2307

De 4 `TS2307`-regels zijn de enige echte oorzaak; alle `TS7006`/`TS2339`/
`TS2345`-regels zijn gevolgschade van dezelfde ontbrekende `pg`-types.

Let op: in een worktree zonder `node_modules` resolveert `pnpm typecheck` `tsc`
niet uit de workspace maar uit **wat er toevallig op `PATH` staat** — op een
developer-machine kan dat een globals geïnstalleerde compiler zijn (gemeten:
`tsc` 6.0.3 uit een andere toolchain, tegen de gepinde `typescript` 5.7). De
rode uitvoer is dan een *compiler-swap*, geen source-defect. De helper
rapporteert daarom altijd de compiler-versie die de gate gebruikt.

### Provisioning

Voer dit één keer uit in een verse worktree, vóór `pnpm lint` / `pnpm typecheck`:

    scripts/dev/worktree-bootstrap.sh

De helper installeert met precies de command die CI ook draait
(`pnpm install --frozen-lockfile`, `.github/workflows/ci.yml:49`), zodat de
worktree exact dezelfde dependency-graph oplost als de release-gate. Hij is
idempotent, raakt de `node_modules` van de primaire checkout nooit aan (dat
wordt voor en na met een fingerprint bewezen) en faalt luid als de primaire
checkout niet vindbaar is.

De helper provisioneert **de worktree waarin hij staat**, niet de map waar je
toevallig in staat. Roep hem dus aan vanuit de worktree-root, of geef het
doel expliciet mee:

    scripts/dev/worktree-bootstrap.sh /pad/naar/worktree

Een worktree symlinken is bewust **niet** gedaan: bij een symlinked
`node_modules` schrijft `pnpm install` de gedeelde target overschrijvend, wat de
primaire checkout zou muteren. De fingerprint bevat daarom zowel de gewone
bestanden als de **symlink-targets** (pnpm legt zijn dependency-graph als
symlinks vast) en zowel de root-`node_modules` als de `apps/api/node_modules`
(waar de `pg`-links staan) — anders zou een herpointering van precies die
links onopgemerkt blijven.

### Status opvragen zonder iets te wijzigen

    scripts/dev/worktree-bootstrap.sh --check

Dit drukt expliciet af of de gate de bron reflecteert of een provisioning-artefact
report. Gebruik dit om een typecheck-fout eenduidig te rapporteren. De
exitcode is `0` bij `PROVISIONED` en `1` bij `NOT PROVISIONED`.

### Een typecheck-fout rapporteren

Meld altijd de uitkomst van `--check` mee. Dan is de oorzaak eenduidig:

- `--check` meldt `PROVISIONED` en `pnpm typecheck` is rood → **echt source-defect**;
  dit is een gate-fail die geblokkeerd moet worden.
- `--check` meldt `NOT PROVISIONED` → de rode `TS2307`/`TS7006`-uitvoer is een
  **provisioning-artefact**. Draai eerst `scripts/dev/worktree-bootstrap.sh` en
  herhaal de gate. Rapporteer dit **niet** als source-defect.

De `pg`-/`@types/pg`-plaatsing in `apps/api/package.json` is intentioneel en
wordt vastgelegd door `tests/smoke/worktree-tooling-contract.test.mjs`.

## TDD

1. Kies één story- of child-ID uit roadmap.md.
2. Open het corresponderende testgeval in test-cases.md.
3. Voeg eerst de falende test toe aan de juiste testlaag.
4. Implementeer binnen de bounded context.
5. Draai lint, typecheck, unit, contract, integration en relevante E2E-tests.
6. Voeg observability, audit en documentatie toe.
7. Laat de release-gates beoordelen.

## Modulegrenzen

De API exposeert application services. Alleen Ledger post canonical activities. Integrations normaliseren naar candidates en sturen die door review/posting. Read models worden uit ledger/events opgebouwd.
