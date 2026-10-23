# QA-audit — 133 Spaartrack parent stories en hun acceptatie-evidence

- **Auditor:** @qa
- **Task:** `t_6af8af27` (Independently audit story acceptance and regression evidence)
- **Datum:** 20 oktober 2026, ~18:20–19:05 CEST
- **Audit-HEAD:** `main` = **`7df0abc`** ("fix(US-0201): keep the compose fixture-key default fail-closed")
- **Audit-worktree:** `/Users/ruben/spaartrack/.worktrees/qa-audit-head` @ `7df0abc` (clean, `node_modules` geprovisioned via `scripts/dev/worktree-bootstrap.sh`)
- **Verdict:** **Poort A is GROEN** op de huidige HEAD (stack-gate **602 tests / 600 pass / 0 fail / 2 skipped**). **Maar de 133-story-claim is NIET houdbaar zoals die in `roadmap.md` staat**: 24 stories hebben uitsluitend statische marker-asserties, 105 stories hebben hun gedragsmatige dekking uitsluitend stack-gated (dus niet in CI), en 47 stories hebben geen reproduceerbaar test-first-bewijs in de git-historie. **Poort B en Poort C zijn afgekeurd.**

> **Belangrijk: `main` is tijdens deze audit verdergegaan.** Toen ik begon was `main` op `c8e6d9a` en was de stack-gate **rood met 118 failures**. De landingskaart `t_edbaa43b` landde de fix tussendoor (nieuwe HEAD `7df0abc`). Deze audit bevat daarom **beide** de meting op de toenmalige HEAD (bewijs van de regressie en van de oorzaak) **en** een **herhaalmeting op de huidige HEAD** (bewijs van de huidige staat). Alle getallen zijn eigen, actuele commando-uitvoering; geen enkele regel is overgenomen uit een eerder rapport.

---

## 1. Tijdlijn: wat de audit zag

| Tijdstip | HEAD | Stack-gate | Default gate |
|---|---|---|---|
| 18:20 (auditstart) | `c8e6d9a` | **583 / 464 pass / 118 fail / 1 skip** | 583 / 442 pass / 0 fail / 141 skip |
| 18:40 | `c8e6d9a` + fix-branch `4d2a312` | **588 / 587 pass / 0 fail / 1 skip** | — |
| 18:44 (`t_edbaa43b` landt) | `7df0abc` | — | — |
| 19:00 (hermeting) | **`7df0abc`** | **602 / 600 pass / 0 fail / 2 skip** | 602 / 459 pass / 0 fail / 143 skip |

---

## 2. De regressie die de audit vond (bewijs, geen aanname)

### 2.1 De meting op `c8e6d9a` (toenmalige HEAD)

De gedeelde dev-stack draaide tijdens de audit (10/10 services healthy). Volledige stack-gate:

```bash
cd /Users/ruben/spaartrack/.worktrees/t_6af8af27
STACK_SMOKE=1 API_URL=http://localhost:18080 WEB_URL=http://localhost:3000 S3_ENDPOINT=http://localhost:19000 \
  node --experimental-strip-types --test tests/unit/*.test.mjs tests/smoke/*.test.mjs
```

```
ℹ tests 583
ℹ pass 464
ℹ fail 118
ℹ skipped 1
EXIT=1
```

De **default gate** was wél groen — precies waarom de regressie onopgemerkt bleef:

```bash
node --experimental-strip-types --test tests/unit/*.test.mjs tests/smoke/*.test.mjs
#   ℹ tests 583 / ℹ pass 442 / ℹ fail 0 / ℹ skipped 141
```

**Rekenkundige sluiting:** 464 + 118 + 1 = 583. Alle 118 failures zaten **binnen de 141 overgeslagen runtime-legs**. Een default gate zonder `STACK_SMOKE` bewijst niets over de runtime.

### 2.2 Drie root causes, elk afzonderlijk bewezen

Ik bracht de 118 failures op een **geïsoleerde** stack (eigen netwerk, eigen postgres-volume, eigen redis, eigen API-container; de gedeelde dev-stack is nooit gemuteerd) tot nul terug door per keer één variabele te corrigeren.

| # | Root cause | Bewijs | Aantal failures |
|---|---|---|---|
| **D1** | 35 testbestanden bootstrappen nog een sessie via de **publieke** route `POST /api/v1/sessions`. Die route weigert sinds `5b89fa8` terecht met `401 AUTHENTICATOR_NOT_CONFIGURED` (geen factor, geen niet-synthetische auth-mode). | `apps/api/src/index.ts:418-433`; 13 bestanden gebruiken `create("/api/v1/sessions", …)`, 24 gebruiken de route zonder fixture-key | **51** op `c8e6d9a`; **45** blijven over als de key wél gezet is |
| **D2** | De **shipped** stack had een **leeg** `SYNTHETIC_FIXTURE_KEY`. `compose.yaml:27` = `${SYNTHETIC_FIXTURE_KEY:-}` en `.env.example:4` = `SYNTHETIC_FIXTURE_KEY=`. De fixture-route weigert dan alles met `401 SYNTHETIC_FIXTURE_AUTH_REQUIRED`. | `docker inspect spaartrack-api-1` → `SYNTHETIC_FIXTURE_KEY` lengte **0**; de tests sturen `local-test-fixture-only` | **67** op `c8e6d9a`; **64** verdwijnen als de key gezet is |
| **D3** | `database/schema.sql` miste de UNIQUE-index `import_mapping_owner_name_version_idx` (wel in migratie `0009`). De API doet `ON CONFLICT (user_id, name, template_version)`, dus een verse bootstrap kon geen import-mapping maken. | `grep -c` = 0 op `c8e6d9a:database/schema.sql`; `\di` op een verse DB toonde alleen `import_mapping_pkey`; API-antwoord `400` | **1** (`US-0602`), zichtbaar zodra D1 en D2 opgelost waren |

D1 en D2 overlappen in 4 bestanden. De herleiding:

```
c8e6d9a, stack-gate          -> 583 tests / 464 pass / 118 fail / 1 skip   (D1 + D2 + D3)
c8e6d9a, key gezet           -> 583 tests / 535 pass /  47 fail / 1 skip   (D1 + D3)
qa/t_auth-runtime-gate 4d2a312 -> 588 tests / 587 pass /  0 fail / 1 skip  (groen)
```

**Bewijs voor D2** — met de key in de container werkt de route, en een verkeerde key wordt geweigerd:

```
$ curl -X POST http://localhost:18333/api/v1/test-fixtures/sessions \
    -H 'x-synthetic-fixture-key: local-test-fixture-only' ...
{"token":"...","user_id":"7e8589c4-…"}   status=201
$ curl ... -H 'x-synthetic-fixture-key: wrong-key' ...
status=401                              # de key wordt wél gecontroleerd
```

**Bewijs voor D3** — met de key gezet maar zonder de index:

```
✖ TC-US-0602-runtime: template is saved, reused and versioned without ledger mutation
  AssertionError: 400 !== 201
  at tests/smoke/import-mapping-contract.test.mjs:49:10
```

### 2.3 De fix — en de security-correctie die er bovenop kwam

De correctie lag klaar op **`qa/t_auth-runtime-gate` @ `4d2a312`** (`2ae323e` + `4d2a312`): 37 smoke-bestanden gemigreerd naar de fixture-route, de fixture-key-default, de ontbrekende index, plus twee nieuwe guards (`auth-session-bootstrap-contract.test.mjs`, `schema-parity-contract.test.mjs`).

**Onafhankelijk geverifieerd** op een verse geïsoleerde stack:

```
ℹ tests 588 / ℹ pass 587 / ℹ fail 0 / ℹ skipped 1     EXIT=0
```

De branch was **gediverged** van `main` (`git merge-base --is-ancestor main qa/t_auth-runtime-gate` → exit 1; 6 commits stonden alleen op `main`), dus een landing was een rebase/cherry-pick, geen fast-forward.

**De security-correctie.** De QA-branch zette de compose-default op de letterlijke waarde `local-test-fixture-only`. Samen met `APP_ENV:-local` (`compose.yaml:24`) en `APP_AUTH_MODE:-synthetic` (`compose.yaml:26`) levert dat, voor elke host die `compose.yaml` draait zonder `.env`:

```
APP_ENV=local  APP_AUTH_MODE=synthetic  SYNTHETIC_FIXTURE_KEY=local-test-fixture-only
```

→ de route-guard (`environment === "local" && authMode === "synthetic"`) is voldaan en `POST /api/v1/test-fixtures/sessions` mint een sessie voor **elk** e-mailadres met een sleutel die in git staat. Dat is een **fail-open** default in het deployment-bestand. `t_06c724c0` (security-ruling, running) adjudiceerde dit; `7df0abc` implementeert optie A:

> `compose.yaml` houdt de **lege fail-closed** default; de lokale sleutel staat **alleen** in `.env.example`. De gedocumenteerde lokale flow `cp .env.example .env` levert dus nog een werkende lokale stack, terwijl een deployment zonder `.env` een lege key krijgt en de route weigert.

De guard-test is omgekeerd van fail-open naar fail-closed, met RED→GREEN tegen beide vormen bewezen.

**Geverifieerd op de huidige HEAD:**

```bash
$ docker compose config | grep -A1 SYNTHETIC_FIXTURE_KEY
      SYNTHETIC_FIXTURE_KEY: ""     # fail-closed ✓
```

---

## 3. Herhoudmeting op de huidige HEAD `7df0abc` — Poort A is groen

Volledig geïsoleerd: eigen netwerk, eigen postgres-volume (opgebouwd uit `database/schema.sql` van HEAD), eigen redis, eigen API-container met de sleutel uit `.env.example`.

```bash
cd /Users/ruben/spaartrack/.worktrees/qa-audit-head
STACK_SMOKE=1 API_URL=http://localhost:18355 WEB_URL=http://localhost:3000 S3_ENDPOINT=http://localhost:19000 \
  node --experimental-strip-types --test tests/unit/*.test.mjs tests/smoke/*.test.mjs
```

```
ℹ tests 602
ℹ pass 600
ℹ fail 0
ℹ skipped 2
EXIT=0
```

**Default gate:**

```
ℹ tests 602 / ℹ pass 459 / ℹ fail 0 / ℹ skipped 143     EXIT=0
```

**De 2 skips zijn beide verklaard en niet-dood:**
- `TC-US-0803-live-runtime` — vereist `BROKER_RUNTIME_TEST=1` (pre-existent, ongewijzigd).
- `TC-US-0602-runtime` — vereist `SCHEMA_BOOTSTRAP_RUNTIME=1`; draait een verse postgres-container op om de schemabootstrap echt te bewijzen. **Apart uitgevoerd en groen:**

```bash
SCHEMA_BOOTSTRAP_RUNTIME=1 node --experimental-strip-types --test tests/smoke/fresh-schema-migration-bootstrap-contract.test.mjs
#   ℹ tests 3 / ℹ pass 3 / ℹ fail 0 / ℹ skipped 0
```

**Overige gates op HEAD:**

| Gate | Resultaat |
|---|---|
| `tsc --noEmit` (na `scripts/dev/worktree-bootstrap.sh`) | **EXIT 0** |
| `docker compose config` | **EXIT 0**, `SYNTHETIC_FIXTURE_KEY: ""` (fail-closed ✓) |
| API-logscan over de volledige run | **3** `error`-regels, alle verwachte negatieve paden: `INVALID_ASSISTANT_ANSWER`, `ADDON_SCOPE_DENIED`, `INVALID_MODEL_SESSION`. Geen `fatal`/`exception`/`panic`/`unhealthy`/`oom`. |
| Gedeelde dev-stack | 10/10 services Up, api/web/db/redis/object-storage healthy, `/health/live` 200, `/health/ready` 200 `ready`, web 200 — **nooit gemuteerd door deze audit** |

---

## 4. Per-story classificatie — 133 parent stories (op HEAD `7df0abc`)

Elke story is geclassificeerd met **mutually-exclusive** prioriteit: `FAILED` > `BEHAVIORAL-GREEN` > `STATIC-ONLY` > `NO-TEST`, op **testblok-niveau** (niet bestandsniveau), waarbij een blok gedragsmatig is als het HTTP/DB/subprocess doet en stack-gated is als het op `STACK_SMOKE`/`BROKER_RUNTIME_TEST` gate't.

| Klasse | Aantal | Betekenis |
|---|---|---|
| **FAILED** | **0** | Geen story heeft nog een falende runtime-test. |
| **VERIFIED** | **109** | Er is een gedragsmatige test, en die is groen. |
| **PARTIAL** | **24** | Er zijn alleen **statische marker-asserties** (lezen `apps/api/src/index.ts` / `apps/web/index.html` en matchen strings). Geen HTTP, geen DOM, geen runtime. |
| **MISSING** | **0** | Elke story heeft minimaal één testblok dat haar noemt. |

Per-story-tabel: `docs/qa/133-story-evidence-classification.md` (133 rijen). Machine-leesbaar: `docs/qa/evidence/133-story-classification.json`.

**PARTIAL — alleen statische marker-asserties (24):**
`US-0001`–`US-0005`, `US-0101`, `US-0103`, `US-0104`, `US-0107`, `US-0501`–`US-0505`, `US-1106`, `US-1107`, `US-1201`–`US-1205`, `US-1207`, `US-1208`, `US-1604`.

**Gating van de gedragsmatige dekking:** van de 133 stories hebben er **109** een gedragsmatige test. Daarvan is die dekking voor **105** uitsluitend **stack-gated** (draait alleen met `STACK_SMOKE=1` — dus niet in de default gate en **niet in CI**). Slechts **4** stories hebben een gedragsmatige test die in de default gate daadwerkelijk draait: `US-0105`, `US-0106`, `US-0204`, `US-1605`. De overige **24** stories hebben helemaal geen gedragsmatige test.

---

## 5. De roadmap-claim versus de werkelijkheid

De leidende status in `roadmap.md` (regel 3) zegt nog:

> "alle **133/133 parent stories** zijn lokaal Done en opnieuw getest op HEAD `366bd0f`; volledige stackregressie **551 tests / 550 pass / 0 fail / 1 skipped**, default gate **551 tests / 418 pass / 0 fail / 133 skipped**"

Meting op de huidige HEAD:

| Claim in `roadmap.md` | Actuele meting (HEAD `7df0abc`) | Status |
|---|---|---|
| 133/133 parent stories Done | 109 VERIFIED, 24 PARTIAL (alleen statische assertions) | **te sterk** — zie G5 |
| stackregressie 551 / 550 pass / 0 fail | **602 tests / 600 pass / 0 fail / 2 skipped** | teller verouderd, uitkomst klopt |
| default gate 551 / 418 pass / 0 fail / 133 skipped | **602 / 459 pass / 0 fail / 143 skipped** | teller verouderd, uitkomst klopt |
| getest op HEAD `366bd0f` | HEAD is nu `7df0abc` (7 commits verder) | **VEROUDERD** |
| `tsc --noEmit` groen | exit 0 | klopt |
| Compose-stack healthy | 10/10 Up, health endpoints 200 | klopt |

De claim is een **historische** meting van vóór de auth-landing (`5b89fa8`) en van vóór drie latere landingen. `roadmap.md` merkt zelf op dat oudere tellers historisch bewijs zijn, maar de **leidende** statusregel is nog steeds de misleidende — en de regel is nog niet bijgewerkt sinds de fix landde.

**De claim is bovendien nooit exact geweest**: 24 stories hebben nooit een gedragsmatige test gehad. "Done" in deze codebase betekent tot nu toe "er is een testbestand dat de TC-id noemt" — niet "het gedrag is bewezen".

---

## 6. Testkwaliteit

### 6.1 Statische marker-asserties

Op HEAD: **57 van de 216** testbestanden zijn statisch (lezen de bron-HTML/TS en matchen strings, zonder HTTP/DOM/runtime). Per laag: **32 unit** + **25 smoke**. Voor **24 parent stories** is dat de *enige* dekking.

Geen van die 24 heeft een gedragsmatige test — ook niet in een ongelabeld testbestand (geverifieerd: 0 van de 24 hebben een untagged gedragsmatige kern-test).

De roadmap claimt voor een aantal van deze stories wél runtime- en GUI-evidence. Voorbeeld — **US-1201**, matrix-regel 640:

> "TC-US-1201 / 1201-A / 1201-B — risk metrics contract, unit, **runtime** en **GUI** | **Groen lokaal** | … In de Codex GUI is synthetische cash-ledger → 5 snapshots → 5 benchmarkobservaties → calculate menselijk uitgevoerd"

De werkelijkheid in `tests/smoke/risk-metrics-contract.test.mjs`:

```js
const api    = fs.readFileSync(new URL("../../apps/api/src/index.ts", import.meta.url), "utf8");
const kernel = fs.readFileSync(new URL("../../apps/api/src/risk-metrics.ts", import.meta.url), "utf8");
const web    = fs.readFileSync(new URL("../../apps/web/index.html", import.meta.url), "utf8");
```

— vier `readFileSync`, geen `fetch`. Er is **geen enkele HTTP-call** naar `/api/v1/risk-metrics` in de hele testsuite. De "runtime"-claim is **menselijke browser-evidence**, geen geautomatiseerde gate.

**12 TC-rijen** in de roadmap-statusmatrix claimen "runtime"/"GUI"-evidence terwijl alleen statische bestanden de TC-id noemen: `TC-US-0501-runtime`, `0502-runtime`, `0503-runtime`, `0504-runtime`, `0505-runtime`, `1106-A/B`, `1107`, `1201/1201-A/1201-B`, `1202`, `1203`, `1204`, `1205`.

### 6.2 De traceability-gate beweest stringpresentie, geen gedrag

`tests/unit/tc-traceability-issue05.test.mjs` doet `corpus.includes(id)`. Gemeten op HEAD:

- De gate verzamelt **263** ids (zijn regex `/TC-US-\d+(?:-[A-Z0-9]+)*/g` mist de **5** lowercase-ids: `TC-US-0802-live`, `TC-US-0802-live-auth`, `TC-US-0802-settings`, `TC-US-0803-live`, `TC-US-0803-live-runtime`).
- De catalogus bevat **268** unieke ids over **133** parents; **0** daarvan ontbreken in de corpus — de catalogus-dekking is dus compleet.
- **44** testbestanden dragen de tekst `ISSUE-05 traceability`; **40** asserties hebben de vorm `assert.ok(id.startsWith(...))`.
- Positief: de substring-zwakte leidt in de huidige staat **niet** tot een falsa-positieve parent-dekking (0 parents zonder exact token). De zwakte is reëel maar momenteel niet uitbuitbaar — de gate bewijst alleen dat een string ergens voorkomt, niet dat een test gedrag afdwingt.

### 6.3 CI dekt de runtime niet

`.github/workflows/ci.yml` (4 jobs: `verify`, `security`, `image`) bevat **geen** `STACK_SMOKE`. De `verify`-job start alleen de API + PostgreSQL + Redis. Daardoor skippen **143 tests** in CI, inclusief alle web/GUI-, object-storage-, community-feed-, incident- en live-runtime-contracten. Er is ook **geen** SAST-stap en **geen** container-scan in `ci.yml` (alleen `gitleaks`).

---

## 7. Test-first-evidence

Conform `AGENTS.md` ("eerst een falende test, dan de implementatie") heb ik per story de **toevoegingscommit van het testbestand** (`git log --diff-filter=A`) vergeleken met de **toevoegingscommit van de story-specifieke kernel** (de monoliete `apps/api/src/index.ts` uitgezonderd, want die bestaat sinds de eerste commit).

| Klasse | Aantal | Betekenis |
|---|---|---|
| `test-first-proven` | 2 | `US-0601`, `US-0901` — testbestand toegevoegd ≤ de implementatiecommit. |
| `test-added-after-impl` | 47 | Het testbestand is **ná** de implementatiecommit toegevoegd. De rode-basisvolgorde is **niet** uit de git-historie te bewijzen. |
| `test-present-impl-only-in-monolith` | 84 | De implementatie zit in `apps/api/src/index.ts`; een aparte kernelcommit bestaat niet, dus ordening is niet af te leiden. |

Voor de 47 stories in de tweede klasse is dit geen bewijs dat er *niet* test-first gewerkt is — het is een bewijs dat de git-historie het **niet** kan aantonen. De roadmap claimt voor deze stories wel een "rode basis (fail → pass)". Die claim is dus **niet reproduceerbaar uit de repository** en steunt uitsluitend op de tekst in `roadmap.md` zelf.

Drie stories hebben wél een expliciete rode-basis-commit in de historie: `US-0001` (`1fee8e3`), `US-0201` (`d0ce3db`), `US-1608` (`0f8dfcf`).

---

## 8. Migraties, schema-pariteit, runtime-DDL

### 8.1 Schema-pariteit (gemeten op twee wegwerfdatabases)

A = alleen `database/schema.sql`, B = `schema.sql` + alle migraties:

```
object counts: A=815  B=822
--- alleen in A (schema.sql) ---   (leeg)
--- alleen in B (schema+migrations) ---
CMTC|bond_profile|face_value|US-1401: nominal (face) value …
CMTC|bond_profile|issue_date|US-1401: bond issue date …
CMT|Canonical import sessions; DEGIRO parser uses degiro-csv-1 …
CMT|Incident evidence events retain trace/correlation …; US-0806 expand marker.
CMT|Provider sync failures and operational incidents are retained …; US-0806 expand marker.
CON|user_totp_factor_failed_attempts_nonnegative|c
IDX|screener_watchlist_user_updated_idx
```

**7 objects** bestaan alleen in de migratieketen. De `import_mapping_owner_name_version_idx` staat inmiddels wél in `schema.sql` (geland in `dbae846`).

### 8.2 Runtime-DDL in API-routes (ISSUE-17)

`grep -c "CREATE TABLE IF NOT EXISTS" apps/api/src/index.ts` → **7**. Deze staan in route-handlers, dupliceren migraties 0022–0026 en omzeilen het migratiecontract uit `AGENTS.md`.

---

## 9. Log-, secret- en datahygiene

**Logscan** op de API-container van de geverifieerde HEAD-run:

```
3 regels met "error" — alle drie verwachte negatieve testpaden:
  {"level":"error","operation":"assistant_answer_failed","error":"INVALID_ASSISTANT_ANSWER", …}
  {"level":"error","operation":"addon_sdk_failed","error":"ADDON_SCOPE_DENIED"}
  {"level":"error","operation":"model_session_failed","error":"INVALID_MODEL_SESSION"}
```

Geen `fatal`, `exception`, `panic`, `unhealthy` of `oom`.

**Secret-scan** over alle getrackte bestanden (gitleaks-achtige regexes: private keys, `AKIA…`, `ghp_…`, `github_pat_…`, `xox[baprs]-…`, `sk-…`, JWT):

```
=== A. tracked-file secret patterns ===
   (leeg — geen enkel getrackt secret)
```

De enige password-achtige toewijzing buiten de placeholders is `POSTGRES_PASSWORD=synthetic-local-only` in een testbestand. Geen echt IBAN, geen echt kaart-/rekeningnummer. Fixture-e-maildomeinen zijn uitsluitend `example.test` / `example.invalid`. **Alle data is synthetisch.**

---

## 10. Gap-lijst met reproduktiecommando's

| # | Gap | Impact | Prerequisites | Reproduktie | Remediation |
|---|---|---|---|---|---|
| **G1** | **RESOLVED tijdens de audit.** De stack-gate was rood met 118 failures op `c8e6d9a` (D1+D2+D3); `t_edbaa43b` landde `2ae323e`+`4d2a312` en `7df0abc` zette de compose-default terug fail-closed. Herhaalmeting op `7df0abc`: **602/600/0/2**. | 102 stories waren rood | geland | `STACK_SMOKE=1 API_URL=http://localhost:18355 node --experimental-strip-types --test tests/{unit,smoke}/*.test.mjs` | **klaar** — blijf de `database/schema.sql`-arbitratie in de **ledger-vorm** bewaken (`IF NOT EXISTS` + `spaartrack.`) |
| **G2** | **RESOLVED.** `import_mapping_owner_name_version_idx` staat nu in `main:database/schema.sql` (`dbae846`), met een rode-basis-guard `tests/smoke/fresh-schema-migration-bootstrap-contract.test.mjs` en een runtime-leg die ik apart groen kreeg. | `US-0602` | geland | `git show main:database/schema.sql \| grep -c import_mapping_owner_name_version_idx` → `1` | **klaar** |
| **G3** | **RESOLVED.** `7df0abc` houdt de compose-default **leeg** (fail-closed); de lokale sleutel staat alleen in `.env.example`. Geverifieerd: `docker compose config` → `SYNTHETIC_FIXTURE_KEY: ""`. | `US-0201`/`US-0203` | security-ruling `t_06c724c0` | `docker compose config \| grep -A1 SYNTHETIC_FIXTURE_KEY` | **klaar** — de guard-test pint nu de fail-closed-vorm |
| **G4** | **105 van de 109 stories met gedragsmatige dekking hebben die dekking uitsluitend stack-gated** → die tests draaien niet in de default gate, en niet in CI (`STACK_SMOKE` ontbreekt in `ci.yml`). Slechts 4 stories hebben een gedragsmatige test die in de default gate draait. | 105 stories | CI-waarde `t_8c391f00` (todo) | `grep -c STACK_SMOKE .github/workflows/ci.yml` → `0`; de default gate slaat 143 tests over | zet `STACK_SMOKE=1` + de stack-services in de CI `verify`-job, of splits de runtime-suite in een eigen job |
| **G5** | **24 stories hebben alleen statische marker-asserties**, terwijl de roadmap voor 12 TC-rijen "runtime/GUI"-evidence claimt. "133/133 Done" is daarmee te sterk. | 24 stories | GUI-extractie `t_ea04ea95` (running) + een DOM/E2E-harness | `grep -L "fetch(" <bestand>` voor elk van de 24 | voeg gedragsmatige runtime-tests toe; corrigeer anders de roadmap-claim naar wat de test feitelijk doet |
| **G6** | **CI mist SAST en container-scan.** `ci.yml` heeft alleen `gitleaks`; de roadmap-poortvereiste noemt SBOM, provenance, digest én een container-scan. | `US-0103`, `US-0104`, Poort B | `t_dc3e1f5b` (running) + `t_8c391f00` (todo) | `grep -niE "sast\|trivy\|scan" .github/workflows/ci.yml` → alleen gitleaks | land beide; één schrijver op `ci.yml` |
| **G7** | **Runtime-DDL in API-routes**: 7× `CREATE TABLE IF NOT EXISTS` in route-handlers, duplicerend migraties 0022–0026. | schema-contract, `US-0004` | ledger-owner (migraties zijn ledger-eigendom) | `grep -c "CREATE TABLE IF NOT EXISTS" apps/api/src/index.ts` → `7` | verhuis naar migraties; de runtime-route mag alleen lezen |
| **G8** | **Test-first niet bewijsbaar uit de historie** voor 47 stories (testbestand ná de kernelcommit) + 84 stories zonder afzonderlijke kernelcommit. | 47 + 84 stories | geen | `git log --diff-filter=A --name-only --all` per testbestand vs. per kernel | geen retro-audit nodig; wel: bij elke nieuwe story de rode-basiscommit **eerst** landen en de `AGENTS.md`-regel handhaven |
| **G9** | **Traceability-gate bewijst stringpresentie, geen gedrag**; 5 lowercase-ids vallen buiten de regex; 44 bestanden dragen de `ISSUE-05 traceability`-tekst. | alle 133 | traceability-census `t_612f7f06` (running) | `tests/unit/tc-traceability-issue05.test.mjs` gebruikt `corpus.includes(id)` | koppel per TC-id een concrete testnaam/assertie; neem lowercase-ids mee |
| **G10** | **Roadmap leidende status is verouderd**: noemt `366bd0f` en de 551/550-tellers; HEAD is `7df0abc` met 602/600. | alle 133 | G1 geland | `git rev-parse main` → `7df0abc`; roadmap regel 3 noemt `366bd0f` | werk de leidende status bij naar de gemeten 602/600/0/2, en qualificeer "133/133 Done" met de 24 static-only stories |
| **G11** | **Release-identiteit niet aan HEAD gekoppeld**: `/api/v1/release` rapporteert `commit_sha=local`, `image_digest=local`. | `US-0102-C` | Poort B-image-pipeline | `curl -s http://localhost:18080/api/v1/release` → `{"commit_sha":"local","image_digest":"local",…}` | zet `APP_COMMIT_SHA`/`APP_IMAGE_DIGEST` op de build-SHA/digest; `TC-US-0102-B/C` moet de **waarde** controleren, niet alleen de aanwezigheid van het veld |
| **G12** | **Schema-drift tussen `schema.sql` en de migratieketen**: 7 objects alleen in migraties (1 index, 1 constraint, 5 comments). | Poort A/B bootstrap | ledger-owner | zie §8.1 | verwerk in de migratieketen of in `schema.sql`; voeg een driftcheck in CI toe |
| **G13** | **Restore-evidence is van 17 oktober** (`.hermes/team/evidence/restore-b005-20261017/restore-report.json`, `row_count: 104`) en dateert van vóór de huidige schema. | `US-0107` | backup/restore-run op de huidige HEAD | `cat .hermes/team/evidence/restore-b005-20261017/restore-report.json` | herhaal `infra/backup/backup-local.sh` + `restore-local.sh` op de huidige HEAD en versieer het bewijs |
| **G14** | **De gedeelde dev-stack draait nog op de oude build** met de lege `SYNTHETIC_FIXTURE_KEY`; `main` is inmiddels verder. Wie `docker compose up -d` zonder `.env` draait krijgt een stack waarvan de runtime-tests rood zijn. | lokale DX | `.env` aanmaken volgens `cp .env.example .env` | `docker inspect spaartrack-api-1 \| grep SYNTHETIC_FIXTURE_KEY` → leeg | `cp .env.example .env && docker compose up -d --build`; documenteer dat `.env` verplicht is voor de lokale runtime-gate |

---

## 11. Commando's die ik daadwerkelijk heb uitgevoerd

```bash
# --- meting op de toenmalige HEAD c8e6d9a (bewijs van de regressie) ---
cd /Users/ruben/spaartrack/.worktrees/t_6af8af27
node --experimental-strip-types --test tests/unit/*.test.mjs tests/smoke/*.test.mjs
#   -> 583 / 442 pass / 0 fail / 141 skipped

STACK_SMOKE=1 API_URL=http://localhost:18080 WEB_URL=http://localhost:3000 S3_ENDPOINT=http://localhost:19000 \
  node --experimental-strip-types --test tests/unit/*.test.mjs tests/smoke/*.test.mjs
#   -> 583 / 464 pass / 118 fail / 1 skipped   EXIT=1

# --- geïsoleerde stack, D2 opgelost (key gezet), D1 resteert ---
bash <isolated-stack.sh> spaartrack-api 18333 local-test-fixture-only
STACK_SMOKE=1 API_URL=http://localhost:18333 … node --experimental-strip-types --test tests/{unit,smoke}/*.test.mjs
#   -> 583 / 535 pass / 47 fail / 1 skipped

# --- fix-branch op een verse geïsoleerde stack (GROEN) ---
bash <fix-branch-stack.sh> 18344 local-test-fixture-only
cd /Users/ruben/spaartrack/.worktrees/t_qa_auth_gate
STACK_SMOKE=1 API_URL=http://localhost:18344 … node --experimental-strip-types --test tests/{unit,smoke}/*.test.mjs
#   -> 588 / 587 pass / 0 fail / 1 skipped   EXIT=0

# --- herhaalmeting op de HUIDIGE HEAD 7df0abc (GROEN) ---
git worktree add --detach /Users/ruben/spaartrack/.worktrees/qa-audit-head main
bash scripts/dev/worktree-bootstrap.sh /Users/ruben/spaartrack/.worktrees/qa-audit-head
bash <head-stack.sh> 18355 local-test-fixture-only
cd /Users/ruben/spaartrack/.worktrees/qa-audit-head
STACK_SMOKE=1 API_URL=http://localhost:18355 … node --experimental-strip-types --test tests/{unit,smoke}/*.test.mjs
#   -> 602 / 600 pass / 0 fail / 2 skipped   EXIT=0
node --experimental-strip-types --test tests/unit/*.test.mjs tests/smoke/*.test.mjs
#   -> 602 / 459 pass / 0 fail / 143 skipped   EXIT=0
SCHEMA_BOOTSTRAP_RUNTIME=1 node --experimental-strip-types --test tests/smoke/fresh-schema-migration-bootstrap-contract.test.mjs
#   -> 3 / 3 pass / 0 fail / 0 skipped
./node_modules/.bin/tsc --noEmit                 # EXIT 0
docker compose config                            # EXIT 0, SYNTHETIC_FIXTURE_KEY: ""
docker logs qa-audit-head-api | grep -icE "error|fatal|exception|panic|unhealthy|oom"   # 3, alle verwachte negatieve paden

# --- schema-pariteit op twee wegwerfdatabases ---
bash <schema-parity2.sh>                          # -> 0 objects alleen in A; 7 objects alleen in B

# --- secret- en synthetische-datascan ---
bash <secret-scan.sh>                             # geen enkel getrackt secret; alleen example.test-domeinen
```

**Isolatie:** alle metingen draaiden op **eigen** netwerken/volumes/redis/API-containers (`qa-audit-t6af8af27-*`, `qa-verify-fix-*`, `qa-parity-*`, `qa-audit-head-*`). De gedeelde `spaartrack_default`-stack, zijn volumes en zijn database zijn **nooit gemuteerd**; ik heb die alleen read-only aangesproken. Alle fixtures en runtime-data zijn synthetisch; geen broker-, bank-, provider- of modelcredential is gebruikt.

---

## 12. Release-gatebeslissing

| Poort | Beslissing | Grond |
|---|---|---|
| **Poort A (local MacBook)** | **GROEN, met een gedocumenteerde kanttekening** | De stack-gate op HEAD `7df0abc` is **602 / 600 pass / 0 fail / 2 skipped**; default gate 602/459/0/143; `tsc` exit 0; `docker compose config` exit 0 met fail-closed key; logscan schoon. **Kanttekening:** 24 van de 133 stories hebben uitsluitend statische assertions, en 105 stories hebben hun gedragsmatige dekking uitsluitend stack-gated (dus niet in CI). De "133/133 Done"-claim is daarmee **te sterk** en moet worden gekwalificeerd. |
| **Poort B (Coolify development)** | **ROOD / open** | Geen remote CI-run, geen image-digest/SBOM-promotion, geen release-identiteit aan HEAD gekoppeld (`commit_sha=local`), geen container-scan en geen SAST in CI, de stack-runtime-suite draait niet in CI, en geen gedragsmatige test voor 24 stories. |
| **Poort C (Coolify production)** | **ROOD / niet geopend** | Vereist bovenop Poort B een goedgekeurde digest, threat-modelreview, restore-drill en een menselijke approval-gate. **De Poort B-gates zijn niet groen**, dus Poort C is niet open. |

**Conclusie.** De regressie die deze audit aantoonde is inmiddels **gerepareerd en door mij onafhankelijk geverifieerd** op de huidige HEAD. Wat overblijft is geen stack-gate-probleem maar een **evidence-probleem**: het project claimt 133/133 bewezen, terwijl 24 stories nooit gedragsmatig getest zijn, 105 stories alleen buiten CI gedekt worden, en 47 stories geen reproduceerbare rode-basis hebben. De roadmap-status moet daarom worden **gekwalificeerd** (G10) in plaats van herhaald, en G4 (CI dekt de runtime niet) is de hoogste prioriteit voor een volwassen Poort B.

**Volgende agent:** @orchestrator (boardreconciliatie; G4/G5/G9/G10 als vervolgkaarten) + @platform (G11 release-identiteit, G6 CI) + @security (G7 runtime-DDL) + @ledger (G12 schema-drift, G13 restore-evidence).
