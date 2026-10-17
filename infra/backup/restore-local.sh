#!/usr/bin/env bash
set -euo pipefail

backup_dir="${1:?usage: restore-local.sh BACKUP_DIR RESTORE_DIR}"
restore_dir="${2:?usage: restore-local.sh BACKUP_DIR RESTORE_DIR}"
passphrase="${SPARTRACK_BACKUP_PASSPHRASE:-}"
postgres_user="${POSTGRES_USER:-spaartrack}"
postgres_db="${POSTGRES_DB:-spaartrack}"
postgres_password="${POSTGRES_PASSWORD:-change-me-local-only}"

if [[ -z "$passphrase" ]]; then
  echo "SPARTRACK_BACKUP_PASSPHRASE is required" >&2
  exit 2
fi

metadata="$(find "$backup_dir" -maxdepth 1 -name 'backup-*.metadata.json' -print -quit)"
if [[ -z "$metadata" ]]; then
  echo "backup metadata not found" >&2
  exit 1
fi

work_dir="$(mktemp -d)"
container_name="spaartrack-restore-$RANDOM"
cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
  rm -rf "$work_dir"
}
trap cleanup EXIT

sha256_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    sha256sum "$1" | awk '{print $1}'
  fi
}

read_artifact() {
  local kind="$1"
  sed -n "s/.*\"kind\": \"$kind\", \"file\": \"\([^\"]*\)\", \"sha256\": \"\([^\"]*\)\".*/\1 \2/p" "$metadata"
}

read -r postgres_artifact postgres_checksum <<<"$(read_artifact postgresql)"
read -r object_artifact object_checksum <<<"$(read_artifact object-storage)"
[[ "$(sha256_file "$backup_dir/$postgres_artifact")" == "$postgres_checksum" ]] || { echo "postgres checksum mismatch" >&2; exit 1; }
[[ "$(sha256_file "$backup_dir/$object_artifact")" == "$object_checksum" ]] || { echo "object-storage checksum mismatch" >&2; exit 1; }

openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in "$backup_dir/$postgres_artifact" -out "$work_dir/postgres.dump" \
  -pass env:SPARTRACK_BACKUP_PASSPHRASE
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in "$backup_dir/$object_artifact" -out "$work_dir/object-storage.tar" \
  -pass env:SPARTRACK_BACKUP_PASSPHRASE

mkdir -p "$restore_dir/object-storage"
tar -xf "$work_dir/object-storage.tar" -C "$restore_dir/object-storage"
docker run -d --name "$container_name" \
  -e POSTGRES_DB="$postgres_db" -e POSTGRES_USER="$postgres_user" \
  -e POSTGRES_PASSWORD="$postgres_password" postgres:16-alpine >/dev/null
until docker exec "$container_name" pg_isready -U "$postgres_user" -d "$postgres_db" >/dev/null 2>&1; do sleep 1; done
docker cp "$work_dir/postgres.dump" "$container_name:/tmp/postgres.dump"
docker exec -e PGPASSWORD="$postgres_password" "$container_name" \
  pg_restore -U "$postgres_user" -d "$postgres_db" --no-owner --exit-on-error /tmp/postgres.dump >/dev/null

schema_count="$(docker exec -e PGPASSWORD="$postgres_password" "$container_name" \
  psql -At -U "$postgres_user" -d "$postgres_db" -c "SELECT count(*) FROM information_schema.schemata WHERE schema_name = 'spaartrack';")"
row_count="$(docker exec -e PGPASSWORD="$postgres_password" "$container_name" \
  psql -At -U "$postgres_user" -d "$postgres_db" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'spaartrack';")"
raw_payload_count="$(find "$restore_dir/object-storage" -type f \( -iname '*raw*' -o -iname '*.json' \) | wc -l | tr -d ' ')"
report_count="$(find "$restore_dir/object-storage" -type f \( -iname '*report*' -o -iname '*.csv' -o -iname '*.pdf' \) | wc -l | tr -d ' ')"
cat > "$restore_dir/restore-report.json" <<EOF
{
  "status": "restored",
  "temporary_database": "$container_name",
  "schema_count": $schema_count,
  "row_count": $row_count,
  "raw_payload_count": $raw_payload_count,
  "report_count": $report_count,
  "object_storage_restore": true
}
EOF
cat "$restore_dir/restore-report.json"
