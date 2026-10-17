# Spaartrack

Private portfolio-, dividend-, performance- en Money Flow-tracker voor self-hosting op Proxmox/Coolify.

## Status

Dit repository bevat de veilige delivery-basis voor de roadmap:

- canonical PostgreSQL-schema in database/schema.sql;
- modulaire monorepo-structuur voor web, API, worker en agent control plane;
- lokale Compose-stack met PostgreSQL, Redis, object storage en observability;
- CI/CD-, Coolify-, backup-, health- en release-contracten;
- testcatalogus met traceability naar alle user stories.

De domeinfeatures worden volgens de dependency-ordered slices en TDD-testgevallen uit roadmap.md gebouwd.

## Starten

    cp .env.example .env
    docker compose up -d --build
    docker compose ps
    curl http://localhost:18080/health/live
    curl http://localhost:18080/health/ready

Belangrijkste lokale endpoints:

| Endpoint | Doel |
|---|---|
| http://localhost:3000 | web bootstrap |
| http://localhost:18080/health/live | proces-health |
| http://localhost:18080/health/ready | dependency-readiness |
| http://localhost:18080/metrics | Prometheus metrics |
| http://localhost:9090 | Prometheus |
| http://localhost:3001 | Grafana |
| http://localhost:19001 | object-storage console |

Zie docs/architecture.md, docs/adr/, database/README.md en roadmap.md.
