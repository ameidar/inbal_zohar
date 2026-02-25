const router = require('express').Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT tc.*, COUNT(t.id)::int as tool_count
      FROM tool_categories tc
      LEFT JOIN tools t ON t.category_id = tc.id
      GROUP BY tc.id ORDER BY tc.name
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM tool_categories WHERE id=$1', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const r = await pool.query('INSERT INTO tool_categories (name, notes) VALUES ($1,$2) RETURNING *', [name, notes]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, notes } = req.body;
    const r = await pool.query(`
      UPDATE tool_categories SET name=COALESCE($1,name), notes=COALESCE($2,notes)
      WHERE id=$3 RETURNING *
    `, [name, notes, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE tools SET category_id=NULL WHERE category_id=$1', [req.params.id]);
    await pool.query('DELETE FROM tool_categories WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
