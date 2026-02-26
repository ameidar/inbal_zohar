const router = require('express').Router();
const pool = require('../db');

// Auto-create insurance payments helper
async function createPayments(client, policyId) {
  const pol = (await client.query('SELECT * FROM insurance_policies WHERE id=$1', [policyId])).rows[0];
  if (!pol || pol.payments_created) return;
  // Delete existing payments if any
  await client.query('DELETE FROM insurance_payments WHERE policy_id=$1', [policyId]);
  const perPayment = +(pol.total_premium / pol.num_payments).toFixed(2);
  const baseDate = new Date(pol.start_date);
  for (let i = 0; i < pol.num_payments; i++) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + i);
    d.setDate(pol.first_charge_day || 1);
    const chargeDate = d.toISOString().split('T')[0];
    await client.query(
      `INSERT INTO insurance_payments (policy_id, payment_number, charge_date, expected_amount, status) VALUES ($1,$2,$3,$4,'פתוח')`,
      [policyId, i+1, chargeDate, perPayment]
    );
  }
  await client.query('UPDATE insurance_policies SET payments_created=true WHERE id=$1', [policyId]);
}

// List policies with vehicle info
router.get('/', async (req, res) => {
  try {
    const { vehicle_id, status } = req.query;
    let where = [];
    let params = [];
    if (vehicle_id) { params.push(vehicle_id); where.push(`p.vehicle_id=$${params.length}`); }
    if (status) { params.push(status); where.push(`p.status=$${params.length}`); }
    const r = await pool.query(`
      SELECT p.*, v.vehicle_number, v.nickname,
        (SELECT COUNT(*)::int FROM insurance_payments ip WHERE ip.policy_id=p.id AND ip.status='פתוח' AND ip.charge_date <= CURRENT_DATE) as overdue_count
      FROM insurance_policies p
      LEFT JOIN vehicles v ON v.id=p.vehicle_id
      ${where.length ? 'WHERE '+where.join(' AND ') : ''}
      ORDER BY p.expiry_date
    `, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const pol = (await pool.query('SELECT p.*, v.vehicle_number, v.nickname FROM insurance_policies p LEFT JOIN vehicles v ON v.id=p.vehicle_id WHERE p.id=$1', [req.params.id])).rows[0];
    if (!pol) return res.status(404).json({ error: 'Not found' });
    const payments = (await pool.query('SELECT * FROM insurance_payments WHERE policy_id=$1 ORDER BY payment_number', [req.params.id])).rows;
    res.json({ ...pol, payments });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { vehicle_id, tool_id, policy_number, coverage_type, insurer, start_date, expiry_date, total_premium, num_payments, first_charge_day, charge_method_id, status, notes } = req.body;
    const r = await client.query(
      `INSERT INTO insurance_policies (vehicle_id, tool_id, policy_number, coverage_type, insurer, start_date, expiry_date, total_premium, num_payments, first_charge_day, charge_method_id, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [vehicle_id, tool_id, policy_number, coverage_type, insurer, start_date||null, expiry_date||null, total_premium, num_payments||1, first_charge_day||1, charge_method_id, status||'פעילה', notes]
    );
    const policy = r.rows[0];
    await createPayments(client, policy.id);
    await client.query('COMMIT');
    res.status(201).json(policy);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const fields = ['vehicle_id','tool_id','policy_number','coverage_type','insurer','start_date','expiry_date','total_premium','num_payments','first_charge_day','charge_method_id','status','notes'];
    const data = req.body;
    const cols = fields.filter(f => data[f] !== undefined);
    if (!cols.length) return res.status(400).json({ error: 'No fields' });
    const dateFields = ['start_date', 'expiry_date'];
    const vals = cols.map(f => (dateFields.includes(f) && data[f] === '') ? null : data[f]);
    vals.push(req.params.id);
    const r = await client.query(`UPDATE insurance_policies SET ${cols.map((f,i)=>`${f}=$${i+1}`).join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    // Recreate payments if key fields changed
    if (['total_premium','num_payments','first_charge_day','start_date'].some(f => cols.includes(f))) {
      await client.query('UPDATE insurance_policies SET payments_created=false WHERE id=$1', [req.params.id]);
      await createPayments(client, +req.params.id);
    }
    await client.query('COMMIT');
    res.json(r.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM insurance_policies WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: req.params.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id/schedule — get schedule items for a policy
router.get('/:id/schedule', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT psi.*, pm.name as payment_method_name
      FROM payment_schedule_items psi
      LEFT JOIN payment_methods pm ON pm.id = psi.payment_method_id
      WHERE psi.policy_id=$1
      ORDER BY psi.installment_number
    `, [req.params.id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update a single payment
router.put('/:id/payments/:pid', async (req, res) => {
  try {
    const { status, actual_amount, actual_payment_date, notes } = req.body;
    const r = await pool.query(
      `UPDATE insurance_payments SET status=COALESCE($1,status), actual_amount=COALESCE($2,actual_amount), actual_payment_date=COALESCE($3,actual_payment_date), notes=COALESCE($4,notes) WHERE id=$5 AND policy_id=$6 RETURNING *`,
      [status, actual_amount, actual_payment_date, notes, req.params.pid, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
