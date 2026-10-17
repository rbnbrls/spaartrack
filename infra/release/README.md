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
