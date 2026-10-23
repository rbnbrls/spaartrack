# Immutable image release contract

De CI-imagejob bouwt `web`, `api` en `worker` met de commit-SHA als immutable
tag. Iedere build krijgt OCI-labels voor commit en versie, BuildKit provenance,
een SBOM en een metadata-artifact met de image-digest.

De OCI-archives en metadata worden als `image-evidence-<run-id>-<service>`
gepubliceerd. Development en production mogen alleen promoveren wanneer hun
digest exact gelijk is. De lokale/promotion-check is:

    DEVELOPMENT_DIGEST=sha256:... \
    PRODUCTION_DIGEST=sha256:... \
    ./infra/release/verify-promotion.sh

Promotiebeleid

PR-bound promotion is retired. Een `pull_request`-workflow gebruikt een
synthetische merge-commit die alleen tijdens die workflow bestaat. De digest
van zo'n build is daarom niet promotable en niet rerunnable: de commit hoort
niet bij een echte branch-ref en mag niet als release-identiteit worden
doorgegeven.

Alleen een digest die is geproduceerd door een `push` naar `main` of naar een
andere echte branch-ref mag worden gepromoveerd. De push-bound Coolify
development deployment gebruikt daarbij de commit-SHA en de image-digest uit
dezelfde push. De versioned route staat in
`infra/coolify/development.yaml`; lokaal kan die route worden gerehearseerd
met `infra/coolify/rehearse-development.sh`.

Promotie blijft digest-gebaseerd en wordt gecontroleerd door
`infra/release/verify-promotion.sh`: de development- en production-digest
moeten exact gelijk zijn en de waarde moet een immutable `sha256:`-digest
zijn. Mutable tags zoals `latest` of een image-tag zijn geen geldige input en
worden geweigerd; een tag mag niet als vervanging voor digest-equality worden
gebruikt.

Credentials blijven buiten Git: gebruik uitsluitend secret references of
Coolify environment values. Deze documentatie beschrijft de development-
deployroute en doet geen uitspraak over productie-deployment.

Een image rollback wijzigt geen database of ledgerdata; schema- en restorebeleid
blijft afzonderlijk van image promotion.

# Immutable image release contract

De CI-imagejob bouwt `web`, `api` en `worker` met de commit-SHA als immutable
tag. Iedere build krijgt OCI-labels voor commit en versie, BuildKit provenance,
een SBOM en een metadata-artifact met de image-digest.

De OCI-archives en metadata worden als `image-evidence-<run-id>-<service>`
gepubliceerd. Development en production mogen alleen promoveren wanneer hun
digest exact gelijk is. De lokale/promotion-check is:

    DEVELOPMENT_DIGEST=sha256:... \
    PRODUCTION_DIGEST=sha256:... \
    ./infra/release/verify-promotion.sh

Een image rollback wijzigt geen database of ledgerdata; schema- en restorebeleid
blijft afzonderlijk van image promotion.

Lokale Compose release-identiteit

Gebruik de wrapper in plaats van `docker compose` rechtstreeks:

    scripts/dev/compose.sh up -d --build

De wrapper leest de actuele `git HEAD` en zet die als `APP_COMMIT_SHA`. Een
expliciet meegegeven `APP_COMMIT_SHA` of `APP_IMAGE_DIGEST` heeft voorrang.
Lokale builds hebben meestal geen registry `RepoDigest`; daarom blijft
`APP_IMAGE_DIGEST=local` het zichtbare, unbound marker (geen gefabriceerde
`sha256`-waarde). Als een echte lokale digest bekend is, kan die offline worden
meegegeven:

    APP_IMAGE_DIGEST=sha256:<64 hex tekens> scripts/dev/compose.sh up -d --build

Dezelfde wrapper werkt zonder registrytoegang. `docker compose` blijft als
lage-level opdracht beschikbaar, maar bindt dan geen commit automatisch.

Expliciete bound/unbound observerbaarheid

De `/api/v1/release` endpoint rapporteert nu drie expliciete vlaggen zodat een
consumer nooit hoeft te gokken of een identiteit gebonden is:

- `commit_sha_bound`: `true` als `commit_sha` een volledige git-SHA is
  (40 of 64 hex), `false` bij de `local` fallback.
- `image_digest_bound`: `true` als `image_digest` een echte `sha256:`
  digest is, `false` bij de `local` fallback.
- `identity_bound`: `true` wanneer *zowel* commit SHA als image digest gebonden
  zijn. Dit is `false` op een lokale dev-stack (geen registry digest).

Deze vlaggen liegen nooit over de waarden die ze beschrijven: `commit_sha_bound`
is `true` als en slechts als `commit_sha` een volledige hex-SHA is, en
`image_digest_bound` is `true` als en slechts als `image_digest` een
`sha256:<64 hex>` vormt. De contract-test `TC-US-0102-B/C` controleert deze
conistentie.

Belangrijk: de `local` fallback voor `image_digest` blijft het eerlijke,
observabele unbound marker. Een lokaal gebouwde image heeft wél een content
digest (`docker image inspect .Id`), maar die is een *config-digest* — niet de
registry manifest-digest die de promotie-poort (`verify-promotion.sh`) vergelijkt.
Het binden van een lokale content-digest zou een valse equivalentie met de
promotie-digest suggereren. Daarom blijft `local` het eerlijke, observabele
marker voor de ontwikkelomgeving.

Bovenbouwlaag bindings

De `compose.yaml` geeft nu `VCS_REF` en `APP_VERSION` als build-argumenten
door aan de Dockerfiles. De image krijgt daarbij de OCI-label
`org.opencontainers.image.revision` die gelijk is aan de `APP_COMMIT_SHA`.
Daarmee is de image-artifact zelf gebonden aan de commit, niet alleen de
runtime-omgevingsvariabele.

Belangrijk: `docker compose up -d --build` (zonder de wrapper) bindt **geen**
commit-SHA. De identiteit is pas gebonden wanneer de stack via de wrapper
(`scripts/dev/compose.sh up -d --build` of `pnpm compose:up`) wordt opgestart.
De runtime-test `TC-US-0102-B/C` faalt expliciet op een ongebonden stack —
dat is de verwachte, bewuste gedraging (zie `tests/smoke/coolify-development.test.mjs`).
