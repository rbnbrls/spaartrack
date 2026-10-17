-- Expand: retain the provider/source version that produced an FX observation.
ALTER TABLE spaartrack.fx_rate
  ADD COLUMN IF NOT EXISTS source_version text NOT NULL DEFAULT 'v1';
