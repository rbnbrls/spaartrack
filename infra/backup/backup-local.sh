#!/usr/bin/env bash
set -euo pipefail

backup_dir="${1:-.local-backups}"
passphrase="${SPARTRACK_BACKUP_PASSPHRASE:-}"
retention_days="${SPARTRACK_BACKUP_RETENTION_DAYS:-30}"
postgres_user="${POSTGRES_USER:-spaartrack}"
postgres_db="${POSTGRES_DB:-spaartrack}"
postgres_password="${POSTGRES_PASSWORD:-change-me-local-only}"

if [[ -z "$passphrase" ]]; then
  echo "SPARTRACK_BACKUP_PASSPHRASE is required" >&2
  exit 2
fi

mkdir -p "$backup_dir"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

docker compose exec -T -e "PGPASSWORD=$postgres_password" db \
  pg_dump -U "$postgres_user" -d "$postgres_db" --format=custom > "$work_dir/postgres.dump"
docker compose exec -T object-storage tar -C /data -cf - . > "$work_dir/object-storage.tar"

openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
  -in "$work_dir/postgres.dump" -out "$backup_dir/postgres-$timestamp.dump.enc" \
  -pass env:SPARTRACK_BACKUP_PASSPHRASE
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
  -in "$work_dir/object-storage.tar" -out "$backup_dir/object-storage-$timestamp.tar.enc" \
  -pass env:SPARTRACK_BACKUP_PASSPHRASE

sha256_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    sha256sum "$1" | awk '{print $1}'
  fi
}

postgres_artifact="postgres-$timestamp.dump.enc"
object_artifact="object-storage-$timestamp.tar.enc"
postgres_checksum="$(sha256_file "$backup_dir/$postgres_artifact")"
object_checksum="$(sha256_file "$backup_dir/$object_artifact")"
cat > "$backup_dir/backup-$timestamp.metadata.json" <<EOF
{
  "backup_id": "local-$timestamp",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "encrypted": true,
  "cipher": "aes-256-cbc",
  "retention_days": $retention_days,
  "source": "local-compose",
  "schema": "spaartrack",
  "artifacts": [
    {"kind": "postgresql", "file": "$postgres_artifact", "sha256": "$postgres_checksum"},
    {"kind": "object-storage", "file": "$object_artifact", "sha256": "$object_checksum"}
  ]
}
EOF

echo "$backup_dir/backup-$timestamp.metadata.json"
