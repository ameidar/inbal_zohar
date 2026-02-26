const router = require('express').Router();
const pool = require('../db');

// GET summary grouped by charge_month + payment_method
router.get('/summary', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        psi.charge_month,
        psi.payment_method_id,
        pm.name as payment_method_name,
        COALESCE(pm.payment_type, pm.name) as payment_type,
        SUM(psi.amount)::numeric as total_amount,
        COUNT(*)::int as item_count,
        COUNT(CASE WHEN psi.status='Paid' THEN 1 END)::int as paid_count,
        COUNT(CASE WHEN psi.status='Planned' THEN 1 END)::int as planned_count
      FROM payment_schedule_items psi
      LEFT JOIN payment_methods pm ON pm.id = psi.payment_method_id
      GROUP BY psi.charge_month, psi.payment_method_id, pm.name, pm.payment_type
      ORDER BY psi.charge_month DESC, pm.name
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all with filters
router.get('/', async (req, res) => {
  try {
    const { policyId, month, status } = req.query;
    let where = []; let params = [];
    if (policyId) { params.push(policyId); where.push(`psi.policy_id=$${params.length}`); }
    if (month) { params.push(month); where.push(`psi.charge_month=$${params.length}`); }
    if (status) { params.push(status); where.push(`psi.status=$${params.length}`); }

    const r = await pool.query(`
      SELECT
        psi.*,
        pol.policy_number,
        pol.coverage_type,
        pol.insurer,
        v.vehicle_number,
        v.nickname,
        pm.name as payment_method_name,
        COALESCE(pm.payment_type, pm.name) as payment_method_type
      FROM payment_schedule_items psi
      LEFT JOIN insurance_policies pol ON pol.id = psi.policy_id
      LEFT JOIN vehicles v ON v.id = pol.vehicle_id
      LEFT JOIN payment_methods pm ON pm.id = psi.payment_method_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY psi.charge_date, psi.charge_month
    `, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT psi.*, pol.policy_number, pol.insurer, v.vehicle_number
      FROM payment_schedule_items psi
      LEFT JOIN insurance_policies pol ON pol.id = psi.policy_id
      LEFT JOIN vehicles v ON v.id = pol.vehicle_id
      WHERE psi.id=$1
    `, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create
router.post('/', async (req, res) => {
  try {
    const { policy_id, payment_method_id, amount, charge_date, charge_month, installment_number, status = 'Planned', notes } = req.body;
    const r = await pool.query(`
      INSERT INTO payment_schedule_items
        (policy_id, payment_method_id, amount, charge_date, charge_month, installment_number, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [policy_id, payment_method_id, amount, charge_date, charge_month, installment_number, status, notes]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update
router.put('/:id', async (req, res) => {
  try {
    const { policy_id, payment_method_id, amount, charge_date, charge_month, installment_number, status, notes } = req.body;
    const r = await pool.query(`
      UPDATE payment_schedule_items
      SET policy_id=COALESCE($1,policy_id),
          payment_method_id=COALESCE($2,payment_method_id),
          amount=COALESCE($3,amount),
          charge_date=COALESCE($4,charge_date),
          charge_month=COALESCE($5,charge_month),
          installment_number=COALESCE($6,installment_number),
          status=COALESCE($7,status),
          notes=COALESCE($8,notes)
      WHERE id=$9 RETURNING *
    `, [policy_id, payment_method_id, amount, charge_date, charge_month, installment_number, status, notes, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM payment_schedule_items WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/payment-schedule/bulk-replace
// Deletes all items for a policy and inserts new ones
router.post('/bulk-replace', async (req, res) => {
  const client = await pool.connect();
  try {
    const { policy_id, items } = req.body;
    if (!policy_id) return res.status(400).json({ error: 'policy_id required' });
    await client.query('BEGIN');
    await client.query('DELETE FROM payment_schedule_items WHERE policy_id=$1', [policy_id]);
    const inserted = [];
    for (const item of (items || [])) {
      const r = await client.query(`
        INSERT INTO payment_schedule_items
          (policy_id, payment_method_id, amount, charge_date, charge_month, installment_number, status, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
      `, [
        policy_id,
        item.payment_method_id || null,
        item.amount,
        item.charge_date || null,
        item.charge_month || null,
        item.installment_number,
        item.status || 'Planned',
        item.notes || null
      ]);
      inserted.push(r.rows[0]);
    }
    await client.query('COMMIT');
    res.json(inserted);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

module.exports = router;
