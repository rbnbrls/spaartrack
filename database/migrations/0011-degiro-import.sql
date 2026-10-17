-- US-0804 uses the existing import_session/import_row_review/reconciliation_issue
-- contract. This marker makes the expand/contract evidence explicit and is safe
-- to apply repeatedly in local and development environments.
COMMENT ON TABLE spaartrack.import_session IS 'Canonical import sessions; DEGIRO parser uses degiro-csv-v1 previews.';
