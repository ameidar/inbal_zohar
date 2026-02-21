-- External API Keys for third-party integrations

CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,              -- human label, e.g. "Make integration"
  key_hash TEXT NOT NULL UNIQUE,   -- SHA-256 hash of the actual key
  key_prefix TEXT NOT NULL,        -- first 8 chars for display (fleet_xxxx...)
  scopes TEXT[] DEFAULT '{"read"}',-- read / write / webhook
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
