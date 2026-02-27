const router = require('express').Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    // Return from operator_license_docs table
    const r = await pool.query(`SELECT * FROM operator_license_docs ORDER BY expiry_date DESC`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM operator_license_docs WHERE id=$1', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { start_date, expiry_date, status = 'Active', document_url, notes } = req.body;
    const r = await pool.query(`
      INSERT INTO operator_license_docs (start_date, expiry_date, status, document_url, notes)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [start_date, expiry_date, status, document_url, notes]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { start_date, expiry_date, status, document_url, notes } = req.body;
    const r = await pool.query(`
      UPDATE operator_license_docs
      SET start_date=COALESCE($1,start_date),
          expiry_date=COALESCE($2,expiry_date),
          status=COALESCE($3,status),
          document_url=COALESCE($4,document_url),
          notes=COALESCE($5,notes)
      WHERE id=$6 RETURNING *
    `, [start_date, expiry_date, status, document_url, notes, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM operator_license_docs WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
