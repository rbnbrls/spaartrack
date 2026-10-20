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

# ---------------------------------------------------------------------------
# Tombstone replay — re-apply every deletion's revocations idempotently.
#
# If the backup was taken AFTER a deletion, its spaartrack.user_deletion_tombstone
# rows shipped inside the dump and are now back in the restored DB. This block
# replays each of them so the restored service cannot resurrect:
#   - the anonymised identity (email=NULL, status=DELETED),
#   - revoked sessions / TOTP / OIDC / portfolio grants (both directions) /
#   - archived owned portfolios, revoked connections/scopes/consents/
#     credential references / push consents, and the physical deletes.
#
# Every statement is idempotent: WHERE ... IS NULL / <> guards make a second
# replay a no-op. If the backup predates a deletion the tombstone is not in
# that backup and therefore not replayed — that case needs an external
# tombstone sidecar (see ADR-0005); on the local path we cover Case B
# (backup after deletion), which is the case Poort B/C gates check.
# ---------------------------------------------------------------------------
docker exec -e PGPASSWORD="$postgres_password" "$container_name" psql -U "$postgres_user" -d "$postgres_db" -v ON_ERROR_STOP=1 <<'TOMBSTONE_SQL'
DO $$
DECLARE
  tid record;
BEGIN
  FOR tid IN SELECT user_id FROM spaartrack.user_deletion_tombstone LOOP
    -- Identity anonymisation (preserves the row for ledger/audit references)
    UPDATE spaartrack.app_user
       SET status = 'DELETED', deleted_at = COALESCE(deleted_at, now()), updated_at = now(),
           email = NULL, display_name = COALESCE(display_name, 'Verwijderd gebruiker'), tax_residency_country = NULL
     WHERE id = tid.user_id AND status <> 'DELETED';

    UPDATE spaartrack.user_session        SET revoked_at = now() WHERE user_id = tid.user_id AND revoked_at IS NULL;
    UPDATE spaartrack.user_totp_factor    SET revoked_at = now() WHERE user_id = tid.user_id AND revoked_at IS NULL;
    UPDATE spaartrack.oidc_login_state    SET consumed_at = now() WHERE user_id = tid.user_id AND consumed_at IS NULL;

    -- Grants: subjects HELD plus grants OTHERS hold on subject-owned portfolios (F1)
    UPDATE spaartrack.portfolio_member SET revoked_at = now()
     WHERE (user_id = tid.user_id
        OR portfolio_id IN (SELECT id FROM spaartrack.portfolio WHERE owner_user_id = tid.user_id))
       AND revoked_at IS NULL;

    UPDATE spaartrack.portfolio_share_link SET revoked_at = now() WHERE created_by = tid.user_id AND revoked_at IS NULL;
    UPDATE spaartrack.accountant_share     SET revoked_at = now() WHERE created_by = tid.user_id AND revoked_at IS NULL;

    UPDATE spaartrack.portfolio
       SET status = 'ARCHIVED', privacy_scope = 'PRIVATE', archived_at = COALESCE(archived_at, now()), updated_at = now()
     WHERE owner_user_id = tid.user_id AND status <> 'DELETED';

    UPDATE spaartrack.external_connection
       SET status = 'REVOKED', disconnected_at = COALESCE(disconnected_at, now()), updated_at = now()
     WHERE user_id = tid.user_id AND status NOT IN ('REVOKED', 'DISCONNECTED');
    UPDATE spaartrack.connection_scope SET revoked_at = now()
     WHERE connection_id IN (SELECT id FROM spaartrack.external_connection WHERE user_id = tid.user_id) AND revoked_at IS NULL;
    UPDATE spaartrack.consent_record SET state = 'REVOKED', revoked_at = now()
     WHERE connection_id IN (SELECT id FROM spaartrack.external_connection WHERE user_id = tid.user_id) AND state <> 'REVOKED';
    UPDATE spaartrack.credential_secret_ref SET revoked_at = now() WHERE user_id = tid.user_id AND revoked_at IS NULL;
    UPDATE spaartrack.push_consent SET status = 'REVOKED', revoked_at = now() WHERE user_id = tid.user_id AND revoked_at IS NULL;

    DELETE FROM spaartrack.auth_identity WHERE user_id = tid.user_id;
    DELETE FROM spaartrack.tax_residency  WHERE user_id = tid.user_id;
  END LOOP;
END
$$;
TOMBSTONE_SQL

tombstones_replayed="$(docker exec -e PGPASSWORD="$postgres_password" "$container_name" \
  psql -At -U "$postgres_user" -d "$postgres_db" -c "SELECT count(*) FROM spaartrack.user_deletion_tombstone;" | tr -d ' \r\n')"
tombstones_replayed="${tombstones_replayed:-0}"

schema_count="$(docker exec -e PGPASSWORD="$postgres_password" "$container_name" \
  psql -At -U "$postgres_user" -d "$postgres_db" -c "SELECT count(*) FROM information_schema.schemata WHERE schema_name = 'spaartrack';")"
table_count="$(docker exec -e PGPASSWORD="$postgres_password" "$container_name" \
  psql -At -U "$postgres_user" -d "$postgres_db" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'spaartrack';")"
ledger_row_count="$(docker exec -e PGPASSWORD="$postgres_password" "$container_name" \
  psql -At -U "$postgres_user" -d "$postgres_db" -c "SELECT count(*) FROM spaartrack.ledger_transaction;")"
ledger_entry_count="$(docker exec -e PGPASSWORD="$postgres_password" "$container_name" \
  psql -At -U "$postgres_user" -d "$postgres_db" -c "SELECT count(*) FROM spaartrack.ledger_entry;")"
ledger_entry_amount_sum="$(docker exec -e PGPASSWORD="$postgres_password" "$container_name" \
  psql -At -U "$postgres_user" -d "$postgres_db" -c "SELECT coalesce(sum(amount), 0) FROM spaartrack.ledger_entry;")"
raw_payload_count="$(find "$restore_dir/object-storage" -type f \( -iname '*raw*' -o -iname '*.json' \) | wc -l | tr -d ' ')"
report_count="$(find "$restore_dir/object-storage" -type f \( -iname '*report*' -o -iname '*.csv' -o -iname '*.pdf' \) | wc -l | tr -d ' ')"
cat > "$restore_dir/restore-report.json" <<EOF
{
  "status": "restored",
  "temporary_database": "$container_name",
  "tombstones_replayed": $tombstones_replayed,
  "schema_count": $schema_count,
  "table_count": $table_count,
  "ledger_row_count": $ledger_row_count,
  "ledger_entry_count": $ledger_entry_count,
  "ledger_entry_amount_sum": $ledger_entry_amount_sum,
  "raw_payload_count": $raw_payload_count,
  "report_count": $report_count,
  "object_storage_restore": true
}
EOF
cat "$restore_dir/restore-report.json"
