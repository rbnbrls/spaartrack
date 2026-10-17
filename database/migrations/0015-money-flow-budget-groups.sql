BEGIN;

CREATE TABLE IF NOT EXISTS spaartrack.budget_group (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_plan_id uuid NOT NULL REFERENCES spaartrack.budget_plan(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (budget_plan_id, name)
);

ALTER TABLE spaartrack.budget_line
  ADD COLUMN IF NOT EXISTS budget_group_id uuid REFERENCES spaartrack.budget_group(id) ON DELETE SET NULL;

COMMIT;
