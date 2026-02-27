const router = require('express').Router();
const pool = require('../db');

// GET all payment methods
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT id,
        COALESCE(payment_type, name) as type,
        last_4_digits as last4,
        charge_day as monthly_charge_day,
        status,
        COALESCE(provider, company) as provider,
        notes,
        name,
        payment_type,
        company,
        account_comprehensive,
        account_mandatory
      FROM payment_methods
      ORDER BY name
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT id,
        COALESCE(payment_type, name) as type,
        last_4_digits as last4,
        charge_day as monthly_charge_day,
        status,
        COALESCE(provider, company) as provider,
        notes, name, payment_type, company, account_comprehensive, account_mandatory
      FROM payment_methods WHERE id=$1
    `, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create
router.post('/', async (req, res) => {
  try {
    const { type, last4, monthly_charge_day, status = 'Active', provider, notes, name } = req.body;
    const r = await pool.query(`
      INSERT INTO payment_methods (name, payment_type, last_4_digits, charge_day, status, provider, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [name || type, type, last4, monthly_charge_day, status, provider, notes]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update
router.put('/:id', async (req, res) => {
  try {
    const { type, last4, monthly_charge_day, status, provider, notes, name } = req.body;
    const r = await pool.query(`
      UPDATE payment_methods
      SET name=COALESCE($1, name),
          payment_type=COALESCE($2, payment_type),
          last_4_digits=COALESCE($3, last_4_digits),
          charge_day=COALESCE($4, charge_day),
          status=COALESCE($5, status),
          provider=COALESCE($6, provider),
          notes=COALESCE($7, notes)
      WHERE id=$8 RETURNING *
    `, [name || type, type, last4, monthly_charge_day, status, provider, notes, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM payment_methods WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
