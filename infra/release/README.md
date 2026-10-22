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
