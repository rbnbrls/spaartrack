# Coolify deployment contract

Maak in Coolify één Git-based Compose resource per omgeving. Gebruik compose.yaml als bron en configureer secrets buiten Git.

De versioned developmentinstellingen staan in `development.yaml`. Voor een
lokale MacBook-rehearsal van dezelfde commit-gebaseerde release:

    COOLIFY_COMMIT_SHA=local-us-0102-sha \
    COOLIFY_IMAGE_DIGEST=sha256:synthetic-us-0102 \
    COOLIFY_MIGRATION_VERSION=schema.sql \
    ./infra/coolify/rehearse-development.sh

De rehearsal controleert readiness en `/api/v1/release`. Een echte Coolify-
deploy vereist daarnaast een door de operator beheerde Coolify destination en
credentials buiten Git; die externe deploy is geen lokale release-evidence.

Deploymentvolgorde:

1. backup/restore-point registreren;
2. expand/contract migration dry-run en uitvoering;
3. nieuwe image starten;
4. readiness en smoke tests uitvoeren;
5. verkeer omschakelen;
6. health window afwachten;
7. release marker en deployment metadata publiceren.
