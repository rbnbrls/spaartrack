-- Expand migration: bond profile schedule inputs (issue date, face value) for the
-- US-1401 coupon/principal cashflow schedule. Canonical ledger is untouched.
BEGIN;

ALTER TABLE spaartrack.bond_profile
  ADD COLUMN IF NOT EXISTS issue_date date;

ALTER TABLE spaartrack.bond_profile
  ADD COLUMN IF NOT EXISTS face_value numeric(28, 12);

COMMENT ON COLUMN spaartrack.bond_profile.issue_date IS 'US-1401: bond issue date used to build the dated coupon schedule; nullable for legacy rows';
COMMENT ON COLUMN spaartrack.bond_profile.face_value IS 'US-1401: nominal (face) value used for coupon and principal amounts';

COMMIT;
