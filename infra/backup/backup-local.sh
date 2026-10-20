#!/usr/bin/env bash
set -euo pipefail

backup_dir="${1:-.local-backups}"
passphrase="${SPARTRACK_BACKUP_PASSPHRASE:-}"
hmac_key="${SPARTRACK_BACKUP_HMAC_KEY:-}"
encryption_key_id="${SPARTRACK_BACKUP_ENCRYPTION_KEY_ID:-synthetic-local-encryption-v1}"
hmac_key_id="${SPARTRACK_BACKUP_HMAC_KEY_ID:-synthetic-local-hmac-v1}"
retention_days="${SPARTRACK_BACKUP_RETENTION_DAYS:-30}"
postgres_user="${POSTGRES_USER:-spaartrack}"
postgres_db="${POSTGRES_DB:-spaartrack}"
postgres_password="${POSTGRES_PASSWORD:-change-me-local-only}"
production=0
if [[ "$(printf '%s' "${APP_ENV:-local}" | tr '[:upper:]' '[:lower:]')" == "production" ]]; then
  production=1
fi

if [[ -z "$passphrase" ]]; then
  echo "SPARTRACK_BACKUP_PASSPHRASE is required" >&2
  exit 2
fi
if [[ -z "$hmac_key" ]]; then
  echo "SPARTRACK_BACKUP_HMAC_KEY is required" >&2
  exit 2
fi
if [[ "$hmac_key" == "$passphrase" ]]; then
  echo "SPARTRACK_BACKUP_HMAC_KEY must differ from SPARTRACK_BACKUP_PASSPHRASE" >&2
  exit 2
fi
if [[ $production -eq 1 ]]; then
  if [[ ${#passphrase} -lt 32 ]]; then
    echo "SPARTRACK_BACKUP_PASSPHRASE must contain at least 32 characters in production" >&2
    exit 2
  fi
  if [[ ${#hmac_key} -lt 32 ]]; then
    echo "SPARTRACK_BACKUP_HMAC_KEY must contain at least 32 characters in production" >&2
    exit 2
  fi
fi
if ! [[ "$retention_days" =~ ^[1-9][0-9]*$ ]] || [[ "$retention_days" -gt 3650 ]]; then
  echo "SPARTRACK_BACKUP_RETENTION_DAYS must be an integer from 1 to 3650" >&2
  exit 2
fi

mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
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

metadata="$backup_dir/backup-$timestamp.metadata.json"
cat > "$metadata" <<EOF
{
  "backup_id": "local-$timestamp",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "encrypted": true,
  "cipher": "aes-256-cbc",
  "integrity": "hmac-sha256",
  "encryption_key_id": "$encryption_key_id",
  "hmac_key_id": "$hmac_key_id",
  "retention_days": $retention_days,
  "source": "local-compose",
  "schema": "spaartrack",
  "artifacts": [
    {"kind": "postgresql", "file": "$postgres_artifact", "sha256": "$postgres_checksum"},
    {"kind": "object-storage", "file": "$object_artifact", "sha256": "$object_checksum"}
  ]
}
EOF
chmod 600 "$metadata" "$backup_dir/$postgres_artifact" "$backup_dir/$object_artifact"

export SPARTRACK_BACKUP_HMAC_KEY
export SPARTRACK_BACKUP_HMAC_KEY_ID
python3 - "$metadata" "$metadata.hmac" <<'PY'
import hashlib
import hmac
import os
import pathlib
import sys

digest = hmac.new(
    os.environ["SPARTRACK_BACKUP_HMAC_KEY"].encode(),
    pathlib.Path(sys.argv[1]).read_bytes(),
    hashlib.sha256,
).hexdigest()
key_id = os.environ.get("SPARTRACK_BACKUP_HMAC_KEY_ID", "synthetic-local-hmac-v1")
pathlib.Path(sys.argv[2]).write_text(f"{key_id} {digest}\n")
PY
chmod 600 "$metadata.hmac"

# Enforce retention: prune expired artifacts (metadata, sidecar, and encrypted dumps)
find "$backup_dir" -maxdepth 1 -type f -mtime "+$retention_days" \
  \( -name 'postgres-*.dump.enc' -o -name 'object-storage-*.tar.enc' \
     -o -name 'backup-*.metadata.json' -o -name 'backup-*.metadata.json.hmac' \) \
  -print -delete

echo "$metadata"