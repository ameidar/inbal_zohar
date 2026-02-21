/**
 * Admin: manage webhook subscriptions
 * Base: /api/admin/webhooks  (JWT + admin only)
 */
const router = require('express').Router();
const crypto = require('crypto');
const pool = require('../db');
const { emit } = require('../lib/webhookEmitter');

/** GET /api/admin/webhooks — list all subscriptions */
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, name, url, events, active, created_at, last_triggered_at, last_status,
              (SELECT username FROM users WHERE id=webhook_subscriptions.created_by) AS created_by
       FROM webhook_subscriptions ORDER BY created_at DESC`
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** POST /api/admin/webhooks — create subscription */
router.post('/', async (req, res) => {
  try {
    const { name, url, events = ['*'], generateSecret = true } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'name and url required' });

    const secret = generateSecret ? crypto.randomBytes(24).toString('hex') : null;

    const r = await pool.query(
      `INSERT INTO webhook_subscriptions (name, url, events, secret, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, url, events, active, created_at`,
      [name, url, events, secret, req.user.id]
    );

    res.status(201).json({ ...r.rows[0], secret }); // return secret only on creation
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** PUT /api/admin/webhooks/:id — update (url, events, active) */
router.put('/:id', async (req, res) => {
  try {
    const { url, events, active } = req.body;
    const updates = [];
    const vals = [];

    if (url     !== undefined) { vals.push(url);     updates.push(`url=$${vals.length}`); }
    if (events  !== undefined) { vals.push(events);  updates.push(`events=$${vals.length}`); }
    if (active  !== undefined) { vals.push(active);  updates.push(`active=$${vals.length}`); }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);

    const r = await pool.query(
      `UPDATE webhook_subscriptions SET ${updates.join(',')} WHERE id=$${vals.length} RETURNING id, name, url, events, active`,
      vals
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** DELETE /api/admin/webhooks/:id — delete subscription */
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM webhook_subscriptions WHERE id=$1 RETURNING id, name', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true, ...r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** POST /api/admin/webhooks/:id/test — fire test event */
router.post('/:id/test', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM webhook_subscriptions WHERE id=$1', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });

    await emit('webhook.test', { message: 'Test event from Fleet Management system' });
    res.json({ sent: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
