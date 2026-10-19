# Slice 14 UI review — Analytics / Bondprofielen & cashflows

Datum: 2026-10-19  
Scope: `Analytics` → `Bondprofielen & cashflows`, bond pricing en yield-curve scenarios.  
Bronnen: `docs/ux-guidelines.md`, `roadmap.md`, `test-cases.md`, synthetic browserflow.

| UX-pijler | Voor fix | Na fix | Evidence |
|---|---:|---:|---|
| Informatiehiërarchie | 2/4 | 4/4 | Eigen h1, KPI-overview en tabelvolgorde |
| Visuele rust en consistentie | 3/4 | 4/4 | Bestaande card/grid/touch-target tokens hergebruikt |
| Data- en statuspresentatie | 2/4 | 4/4 | Coupon/principal tekstlabels, table alternative, empty/loading/error states |
| Interactie en feedback | 2/4 | 4/4 | Module selector, reset, fixture, generation, pricing en curve actions getest |
| Responsive/toegankelijkheid | 3/4 | 4/4 | Semantische heading/region/table, scope headers, live status, 44px controls |
| Vertrouwen en observability | 2/4 | 4/4 | Read-only source, calculation versions en trace/correlation IDs; foutlogs dragen dezelfde IDs |

## Verificatie

- UX-regressie: 3/3 groen.
- Volledige lokale suite: 526 tests, 395 pass, 0 fail, 131 skipped.
- Typecheck: groen.
- Browser: overview/reset, module selector, synthetic fixture, cashflow generation, pricing en parallel shift gecontroleerd.
- Fresh browser-tab console: 0 errors/warnings.
- Compose rebuild: `api` en `web` healthy; geen echte provider-, broker-, bank- of modelcredentials gebruikt.
