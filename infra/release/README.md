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
