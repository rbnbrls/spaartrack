-- US-0806: reuse the canonical incident tables for provider sync failure evidence.
-- This expand marker is intentionally idempotent; incident/incident_event already
-- provide the backward-compatible persistence contract in database/schema.sql.
COMMENT ON TABLE spaartrack.incident IS 'Provider sync failures and operational incidents are retained with evidence; US-0806 expand marker.';
COMMENT ON TABLE spaartrack.incident_event IS 'Incident evidence events retain trace/correlation and retry context; US-0806 expand marker.';
