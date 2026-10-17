# Lokale backup- en restore-rehearsal

De lokale rehearsal gebruikt uitsluitend synthetische data en schrijft backups
naar een expliciet opgegeven directory. De PostgreSQL-dump en object-storage-
tarball worden met AES-256-CBC/PBKDF2 versleuteld; metadata bevat checksum,
retention en artifact-identiteit.

```sh
export SPARTRACK_BACKUP_PASSPHRASE='synthetic-local-passphrase'
infra/backup/backup-local.sh /tmp/spaartrack-backup
infra/backup/restore-local.sh /tmp/spaartrack-backup /tmp/spaartrack-restore
```

Restore start een tijdelijke PostgreSQL 16-container, controleert schema- en
table-counts en schrijft `restore-report.json`. Een image rollback geldt niet
als database rollback; herstel blijft een afzonderlijke handeling.
