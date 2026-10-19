BEGIN;

CREATE TABLE IF NOT EXISTS spaartrack.community_post (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES spaartrack.app_user(id) ON DELETE CASCADE,
  visibility text NOT NULL CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
  status text NOT NULL CHECK (status IN ('VISIBLE', 'PRIVATE', 'PENDING', 'REJECTED', 'DELETED')),
  title text NOT NULL,
  body text NOT NULL,
  public_metrics jsonb NOT NULL DEFAULT '{}',
  moderation_reason text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_post_feed_idx ON spaartrack.community_post (status, visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS community_post_owner_idx ON spaartrack.community_post (owner_user_id, created_at DESC);

COMMIT;
