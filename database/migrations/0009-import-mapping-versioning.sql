BEGIN;

ALTER TABLE spaartrack.import_mapping
  ADD COLUMN IF NOT EXISTS template_version integer NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS import_mapping_owner_name_version_idx
  ON spaartrack.import_mapping (user_id, name, template_version);

COMMIT;
