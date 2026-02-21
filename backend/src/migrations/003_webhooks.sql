-- Outbound webhook subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] DEFAULT '{"*"}',  -- "*" = all events, or specific: "vehicle.update", "maintenance.create", etc.
  secret TEXT,                    -- optional HMAC-SHA256 signing secret
  active BOOLEAN DEFAULT true,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ,
  last_status INT                 -- last HTTP response code
);
