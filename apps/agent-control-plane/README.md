# Agent control plane

Guarded orchestration boundary voor incident-, release- en Hermes-runs. Dit component krijgt alleen scoped service accounts en mag zichzelf of zijn permissions niet wijzigen.

Implementatievolgorde:

1. read-only evidence verzamelen;
2. incident en hypothesis registreren;
3. patch branch en regression test voorstellen;
4. CI/staging laten verifiëren;
5. release policy laten beoordelen;
6. alleen allowlisted safe actions uitvoeren.
