-- Expand migration: persist the last accepted TOTP counter and failed-attempt lockout.
ALTER TABLE spaartrack.user_totp_factor
  ADD COLUMN IF NOT EXISTS last_used_counter bigint,
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_totp_factor_failed_attempts_nonnegative'
      AND conrelid = 'spaartrack.user_totp_factor'::regclass
  ) THEN
    ALTER TABLE spaartrack.user_totp_factor
      ADD CONSTRAINT user_totp_factor_failed_attempts_nonnegative CHECK (failed_attempts >= 0);
  END IF;
END $$;
