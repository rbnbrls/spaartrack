-- Expand migration: generic OIDC provider configuration.
CREATE TABLE IF NOT EXISTS spaartrack.oidc_provider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  issuer_url text NOT NULL,
  client_id text NOT NULL,
  client_secret_ref text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['openid', 'email', 'profile'],
  pkce_enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER oidc_provider_updated_at BEFORE UPDATE ON spaartrack.oidc_provider
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();