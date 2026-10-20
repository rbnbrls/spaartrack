# ADR-0003: Trading 212 read-only verbinding

Status: Accepted voor lokale implementatie, US-0802 / US-0803, 20 oktober 2026.

Trading 212 gaat via de `Trading212Adapter` in `packages/integration-contracts`. De adapter gebruikt uitsluitend GET op vaste live/demo hosts, Basic API key + secret, account summary, positions en gepagineerde order-, dividend- en geldmutatiehistorie. Redirects en paginering buiten het oorspronkelijke endpoint zijn verboden. Fouten bevatten uitsluitend eigen foutcodes; provider bodies en credentials komen niet in logs.

API-requests plaatsen een duurzame `sync_run`; een afzonderlijke `broker-worker` haalt data op. PostgreSQL advisory locks serialiseren per verbinding, inclusief hervatten na een crash. Een revoke wordt vóór ieder volgend providerverzoek en vóór opslag gecontroleerd. Alleen een volledige succesvolle run slaat de snapshot en checkpoint transactioneel op. Herhaalde runs vergelijken provideridentiteiten én JSONB-inhoud: NEW, UPDATED of DUPLICATE. Een orderuitvoering heeft order-ID én fill-ID; namespaces scheiden dividend- en geldmutatie-ID's. Er is geen automatische ledgerposting.

Credentials worden met AES-256-GCM versleuteld, met owner/connection als authenticated associated data. `credential_secret_ref` bevat alleen een vault-referentie; `broker_credential` bevat ciphertext. Lokaal staat de willekeurige mastersleutel in het afzonderlijke persistente volume `broker-secrets`, met mode 0600. Buiten local is `BROKER_MASTER_KEY` uit de deployment secret store verplicht. Database én sleutel moeten afzonderlijk worden geback-upt. Een image rollback draait de expand-migratie niet terug.

De bestaande GUI heeft uitsluitend synthetische identity-flows. Daarom gebruikt brokerbeheer een afzonderlijke, met scrypt beveiligde owner-login en acht-uursessies. Broker-sessies zijn niet geldig voor de demo/ledger-API. Passwordless demo-login en synthetische OIDC zijn voor broker-owners uitgesloten. Registratie kan nooit een bestaande demo-gebruiker overnemen. Dit is een beperkte identity-boundary voor Integrations; productie-OIDC/2FA, recovery en release-gates blijven aparte roadmapverplichtingen.

De lokale GUI toont brokerdata in Settings, gescheiden van het demoportfolio. Investeringsacties gaan naar opgeslagen reviewrecords. Er worden geen orders geplaatst, brokercredentials ingetrokken bij de provider of ledgertransacties direct gemuteerd. Ontkoppelen verwijdert lokaal credentialmateriaal en annuleert actieve jobs; historische gegevens blijven behouden.

Eerste versie leest bij iedere handmatige sync alle historische pagina's, met een veiligheidslimiet van 100 pagina's per historie-endpoint. Er wordt geen onvolledige historie als succesvol gerapporteerd. Er is geen geplande autosync. Cursoroptimalisatie, grotere backfills en canonical posting zijn vervolgstappen.

Bronnen, gecontroleerd op 19 oktober 2026: [Trading 212 API](https://docs.trading212.com/api), [account](https://docs.trading212.com/api/accounts/getaccountsummary), [positions](https://docs.trading212.com/api/positions/getpositions), [historie](https://docs.trading212.com/api/historical-events).
