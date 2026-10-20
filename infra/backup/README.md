# Lokale backup- en restore-rehearsal

De lokale rehearsal gebruikt uitsluitend synthetische data en schrijft backups
naar een expliciet opgegeven directory. De PostgreSQL-dump en object-storage-tarball worden met AES-256-CBC/PBKDF2
versleuteld. Omdat CBC zelf geen authenticatie biedt, SHA-256-checksums van de
ciphertexts in metadata worden beschermd door een aparte HMAC-SHA-256. Herstel
verifieert die HMAC (constant-time), valideert artifactnamen en hashes vóór
decryptie, en vergelijkt ledger-balance-, snapshot-projection- en report-run-
totalen tussen de backupmetadata en de geïsoleerde restore. Een verschil faalt
de restore gate. Lokale retentie wordt afgedwongen door oude backupartifacten
op te schonen (in minuten, niet alleen als metadata); de metadataretentie is
geen vervanging voor dit opruimen. De lokale policy begrenst retentie op 1–3650
dagen.

```sh
export SPARTRACK_BACKUP_PASSPHRASE='<synthetic-only secret, >=32 chars>'
export SPARTRACK_BACKUP_HMAC_KEY='<different synthetic-only secret, >=32 chars>'
export SPARTRACK_BACKUP_ENCRYPTION_KEY_ID='synthetic-local-encryption-v1'
export SPARTRACK_BACKUP_HMAC_KEY_ID='synthetic-local-hmac-v1'
export SPARTRACK_BACKUP_RETENTION_DAYS=30
infra/backup/backup-local.sh "$HOME/.cache/spaartrack-backup"
infra/backup/restore-local.sh "$HOME/.cache/spaartrack-backup" "$HOME/.cache/spaartrack-restore"
```

Gebruik geen echte productiegeheimen in lokale shellgeschiedenis, fixtures of
logs. In production moeten encryptie- en HMAC-sleutels afzonderlijke least-
privilege vault references zijn die alleen aan de backup/restore-job worden
gegeven; bewaar ze niet naast de backup. Houd oude decryptiesleutels beschikbaar
tot alle backups die ermee zijn gemaakt hun retentie hebben overschreden. Roteer
actieve sleutels via gecontroleerde nieuwe references, en documenteer aparte
her-encryptie/rotatie van bestaande TOTP-factoren voordat een TOTP-sleutel wordt
gewisseld. De lokale API-call gebruikt uitsluitend `TOTP_ENCRYPTION_KEY`; de
applicatie weigert production startup als die ontbreekt of korter is dan 32
tekens. Dit is geen bewijs van een productie vault-configuratie.

Restore vereist een lege restore-directory, start een tijdelijke PostgreSQL
16-container en schrijft `restore-report.json`; het script verwijdert die
container na de run. De lokale rehearsal is geen production restore-drill of
bewijs van production key custody. Een image rollback geldt niet als database
rollback; herstel blijft een afzonderlijke, expliciet geautoriseerde handeling.