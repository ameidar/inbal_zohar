const router = require('express').Router();
const pool = require('../db');

// List invoices
router.get('/invoices', async (req, res) => {
  try {
    const r = await pool.query(`SELECT fi.*, (SELECT COUNT(*)::int FROM fuel_invoice_lines WHERE fuel_invoice_id=fi.id) as line_count FROM fuel_invoices fi ORDER BY fi.period DESC, fi.invoice_date DESC`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/invoices/:id', async (req, res) => {
  try {
    const inv = (await pool.query('SELECT * FROM fuel_invoices WHERE id=$1', [req.params.id])).rows[0];
    if (!inv) return res.status(404).json({ error: 'Not found' });
    const lines = (await pool.query(`SELECT fil.*, v.vehicle_number, v.nickname FROM fuel_invoice_lines fil LEFT JOIN vehicles v ON v.id=fil.vehicle_id WHERE fil.fuel_invoice_id=$1 ORDER BY fil.vehicle_number_raw`, [req.params.id])).rows;
    res.json({ ...inv, lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/invoices', async (req, res) => {
  try {
    const { supplier, period, invoice_date, total_liters_diesel, total_amount_diesel, total_liters_petrol, total_amount_petrol, total_amount, notes } = req.body;
    const r = await pool.query(`INSERT INTO fuel_invoices (supplier, period, invoice_date, total_liters_diesel, total_amount_diesel, total_liters_petrol, total_amount_petrol, total_amount, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [supplier, period, invoice_date, total_liters_diesel, total_amount_diesel, total_liters_petrol, total_amount_petrol, total_amount, notes]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/invoices/:id', async (req, res) => {
  try {
    const fields = ['supplier','period','invoice_date','total_liters_diesel','total_amount_diesel','total_liters_petrol','total_amount_petrol','total_amount','notes'];
    const data = req.body;
    const cols = fields.filter(f => data[f] !== undefined);
    const vals = [...cols.map(f => data[f]), req.params.id];
    const r = await pool.query(`UPDATE fuel_invoices SET ${cols.map((f,i)=>`${f}=$${i+1}`).join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/invoices/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM fuel_invoices WHERE id=$1', [req.params.id]);
    res.json({ deleted: req.params.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Import lines (JSON array): [{vehicle_number, fuel_type, liters, amount, period}]
router.post('/invoices/:id/import-lines', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { lines = [], replace = false } = req.body;
    if (replace) await client.query('DELETE FROM fuel_invoice_lines WHERE fuel_invoice_id=$1', [req.params.id]);
    // Get vehicle map
    const vMap = {};
    const vRows = (await client.query('SELECT id, vehicle_number FROM vehicles')).rows;
    vRows.forEach(r => vMap[r.vehicle_number] = r.id);
    const results = [];
    for (const line of lines) {
      const vid = vMap[line.vehicle_number] || null;
      const r = await client.query(`INSERT INTO fuel_invoice_lines (fuel_invoice_id, vehicle_id, vehicle_number_raw, period, fuel_type, liters, amount) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.params.id, vid, line.vehicle_number, line.period, line.fuel_type, line.liters, line.amount]);
      results.push({ ...r.rows[0], matched: !!vid });
    }
    await client.query('COMMIT');
    const unmatched = results.filter(r => !r.matched).length;
    res.json({ imported: results.length, unmatched, results });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// Fuel cards
router.get('/cards', async (req, res) => {
  try {
    const { vehicle_id, status } = req.query;
    let where = []; let params = [];
    if (vehicle_id) { params.push(vehicle_id); where.push(`fc.vehicle_id=$${params.length}`); }
    if (status) { params.push(status); where.push(`fc.status=$${params.length}`); }
    const r = await pool.query(`SELECT fc.*, v.vehicle_number, v.nickname FROM fuel_cards fc LEFT JOIN vehicles v ON v.id=fc.vehicle_id ${where.length ? 'WHERE '+where.join(' AND ') : ''} ORDER BY fc.card_number`, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/cards', async (req, res) => {
  try {
    const fields = ['card_number','supplier','vehicle_id','asset_type','status','fuel_type','daily_limit','monthly_limit','notes'];
    const data = req.body;
    const cols = fields.filter(f => data[f] !== undefined);
    const vals = cols.map(f => data[f]);
    const r = await pool.query(`INSERT INTO fuel_cards (${cols.join(',')}) VALUES (${cols.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`, vals);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/cards/:id', async (req, res) => {
  try {
    const fields = ['card_number','supplier','vehicle_id','asset_type','status','fuel_type','daily_limit','monthly_limit','notes'];
    const data = req.body;
    const cols = fields.filter(f => data[f] !== undefined);
    const vals = [...cols.map(f => data[f]), req.params.id];
    const r = await pool.query(`UPDATE fuel_cards SET ${cols.map((f,i)=>`${f}=$${i+1}`).join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/cards/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM fuel_cards WHERE id=$1', [req.params.id]);
    res.json({ deleted: req.params.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
