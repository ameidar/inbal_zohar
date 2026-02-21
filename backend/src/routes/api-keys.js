/**
 * Admin: manage external API keys
 * Base: /api/admin/api-keys  (JWT protected, admin only)
 */
const router = require('express').Router();
const crypto = require('crypto');
const pool = require('../db');

function generateKey() {
  // fleet_ + 40 random hex chars
  return 'fleet_' + crypto.randomBytes(20).toString('hex');
}

/** GET /api/admin/api-keys — list all keys (no raw key shown) */
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, name, key_prefix, scopes, created_at, last_used_at, revoked_at,
              (SELECT username FROM users WHERE id=api_keys.created_by) AS created_by
       FROM api_keys ORDER BY created_at DESC`
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** POST /api/admin/api-keys — create new key; returns raw key ONCE */
router.post('/', async (req, res) => {
  try {
    const { name, scopes = ['read'] } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const rawKey = generateKey();
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix = rawKey.slice(0, 12); // "fleet_xxxxxx"

    const r = await pool.query(
      `INSERT INTO api_keys (name, key_hash, key_prefix, scopes, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, key_prefix, scopes, created_at`,
      [name, hash, prefix, scopes, req.user.id]
    );

    // Return raw key only this once — it can never be recovered
    res.status(201).json({ ...r.rows[0], key: rawKey });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** DELETE /api/admin/api-keys/:id — revoke key */
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE api_keys SET revoked_at=NOW() WHERE id=$1 AND revoked_at IS NULL RETURNING id, name`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Key not found or already revoked' });
    res.json({ revoked: true, ...r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
