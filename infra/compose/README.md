# Compose-omgevingen

compose.yaml is de lokale bootstrap. Coolify gebruikt dezelfde servicegrenzen met environment-specifieke image tags, secrets en volumes.

Omgevingsregels:

- local: fake providers, synthetische data en lokale volumes;
- preview: ephemeral database/schema en geen echte providercredentials;
- staging: sandbox providers, restore rehearsal en synthetic journeys;
- production: immutable digest, pinned migration en encrypted backups.
