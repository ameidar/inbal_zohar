const crypto = require('crypto');
const pool = require('../db');

/**
 * Authenticate via X-API-Key header or ?api_key= query param.
 * Attaches req.apiKey = { id, name, scopes } on success.
 */
async function apiKeyAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!key) return res.status(401).json({ error: 'API key required (X-API-Key header)' });

  const hash = crypto.createHash('sha256').update(key).digest('hex');

  try {
    const r = await pool.query(
      `SELECT id, name, scopes FROM api_keys WHERE key_hash=$1 AND revoked_at IS NULL`,
      [hash]
    );
    if (!r.rows[0]) return res.status(401).json({ error: 'Invalid or revoked API key' });

    req.apiKey = r.rows[0];

    // Update last_used_at in background (non-blocking)
    pool.query('UPDATE api_keys SET last_used_at=NOW() WHERE id=$1', [r.rows[0].id]).catch(() => {});

    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/** Require a specific scope */
function requireScope(scope) {
  return (req, res, next) => {
    if (!req.apiKey?.scopes?.includes(scope)) {
      return res.status(403).json({ error: `Scope '${scope}' required` });
    }
    next();
  };
}

module.exports = { apiKeyAuth, requireScope };
