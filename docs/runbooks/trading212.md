# Trading 212 verbinden (US-0802 / US-0803)

Open lokaal http://127.0.0.1:3000 → Settings → Trading 212. Maak één vaste gebruiker aan met een eigen e-mailadres en wachtwoord (minimaal 12 tekens). Gebruik diezelfde login bij volgende bezoeken. De demo-gebruikers kunnen geen echte brokerverbindingen openen.

Maak in Trading 212 Settings → API een API key en secret voor het gewenste Invest- of Stocks ISA-account. Kies alleen de leesrechten Account data, Portfolio, History: Orders, History: Dividends en History: Transactions. Vul eventuele IP-restricties in voor het uitgaande IP van de server. Gebruik geen handelsrechten. Vul de key en secret uitsluitend in de Spaartrack-GUI in; niet in een issue, chat, log of `.env`.

Kies Live voor echte brokerdata of Demo voor een Trading 212-oefenaccount. Kies het accounttype waarvoor de key is gemaakt. Klik **Verbinden en synchroniseren**. De worker controleert de credentials en haalt saldo, posities, orderuitvoeringen, dividenden en geldmutaties op. De status wordt automatisch ververst zolang een taak loopt. Na succes verschijnen accountwaarde, beschikbaar saldo, aantallen en laatste succesvolle sync. **Gegevens bekijken** toont maximaal 200 reviewrecords; alle opgehaalde data staat in de database.

**Synchroniseren** start een nieuwe handmatige run. Herhaalde records worden als ongewijzigd gemarkeerd, gewijzigde records als gewijzigd. Brokerdata wordt nog niet automatisch in het demoportfolio of de canonical ledger geboekt. Ontkoppelen stopt vervolgrequests, verwijdert lokaal opgeslagen API-sleutels en bewaart historie. Trek de key zelf ook bij Trading 212 in als deze nergens anders nodig is. Voor nieuwe credentials: ontkoppel de oude verbinding en voeg een nieuwe toe.

## Lokale installatie / upgrade

Bij een nieuwe database zit de migratie in `schema.sql`. Bij een bestaande lokale database:

```sh
docker compose exec -T db psql -U spaartrack -d spaartrack -v ON_ERROR_STOP=1 < database/migrations/0027-trading212-live.sql
docker compose up -d --build api broker-worker web
```

De migratie is expand-only en idempotent. De API- en broker-worker-images delen hetzelfde buildcontract. De bestaande Redis-worker blijft beschikbaar voor overige jobs. Queuegegevens staan duurzaam in PostgreSQL.

De lokale mastersleutel wordt automatisch in `broker-secrets:/var/lib/spaartrack-secrets/broker.key` aangemaakt. Verwijder dat volume niet. Buiten local: configureer voor API én broker-worker dezelfde `BROKER_MASTER_KEY` (64 hextekens, 32 willekeurige bytes) via de secret store. Wijzig een bestaande sleutel niet zonder herencryptie van credentials. Backup database en sleutel afzonderlijk; zonder de sleutel kunnen verbindingen alleen opnieuw worden gekoppeld. Herstel eerst schema/data en de oorspronkelijke sleutel, start vervolgens de worker. Een image rollback verandert het schema niet.

## Verificatie

- Adapter-/securitytests: `node --experimental-strip-types --test tests/unit/trading212-live.test.mjs tests/unit/trading212-settings.test.mjs` (Node 22).
- `tests/smoke/trading212-live-runtime.test.mjs` draait met `BROKER_RUNTIME_TEST=1` in het API-image, `/work/tests` gemount en `DATABASE_URL` naar een afzonderlijke synthetische testdatabase. Mount/zet een uitsluitend synthetische `BROKER_KEY_FILE`; de normale regressiesuite slaat deze gespecialiseerde container-test over.
- `tests/fixtures/trading212-gui-server.mjs` is een losse GUI-harness in het API-image, met `/web` en `/fixtures` als read-only mounts en een database waarvan de naam op `_test` eindigt. Deze server gebruikt alleen fake providerantwoorden en wordt nooit in de applicatie gestart. Fixture credentials: `synthetic-key` en `synthetic-secret`.
- De productieadapter kent geen fake-provider URL override. Tests injecteren fetch uitsluitend in het proces dat de test uitvoert.

## Fouten en grenzen

401: controleer key, secret en Live/Demo. 403: leesrechten of IP-beperking. 429: automatische herhaling tot drie pogingen, met Retry-After of x-ratelimit-reset; probeer later opnieuw bij blijvende begrenzing. Onverwacht schema, netwerkfout of meer dan 100 historiepagina's per endpoint: run faalt zichtbaar en de laatste succesvolle data/checkpoint blijven behouden. Snapshotdata worden pas na volledige paginering opgeslagen. Een workercrash kan de volledige job veilig opnieuw uitvoeren.

Deze implementatie is lokaal met synthetische data getest. Een succesvolle echte sync vereist door de eigenaar ingevoerde geldige credentials. Dit bewijs is geen production-release: Poort B/C, HTTPS, production auth/recovery, threat-model review en operationele gates blijven gelden.
