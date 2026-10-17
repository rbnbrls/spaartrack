BEGIN;

ALTER TABLE spaartrack.import_row_review
  DROP CONSTRAINT IF EXISTS import_row_review_status_check;

ALTER TABLE spaartrack.import_row_review
  ADD CONSTRAINT import_row_review_status_check
  CHECK (status IN ('PENDING', 'VALID', 'WARNING', 'ERROR', 'UNSUPPORTED', 'ACCEPTED', 'REJECTED', 'DUPLICATE'));

COMMIT;
