/**
 * Generic CRUD route factory.
 * Usage: app.use('/api/employees', crud('employees', ['name','id_number','role','phone','email','start_date','end_date','active','salary_type','salary_amount','notes']))
 */
const express = require('express');
const pool = require('../db');
const webhook = require('../lib/webhookEmitter');

function crud(table, fields, opts = {}) {
  const router = express.Router();
  const { orderBy = 'id', joins = '' } = opts;

  // LIST
  router.get('/', async (req, res) => {
    try {
      const { q, status, ...filters } = req.query;
      let where = [];
      let params = [];
      if (q) {
        where.push(`(${fields.slice(0,3).map((f,i) => `${table}.${f}::text ILIKE $${params.length+1}`).join(' OR ')})`);
        params.push(`%${q}%`);
      }
      Object.entries(filters).forEach(([k, v]) => {
        if (fields.includes(k) && v) {
          params.push(v);
          where.push(`${table}.${k} = $${params.length}`);
        }
      });
      if (status) { params.push(status); where.push(`${table}.status = $${params.length}`); }
      const sql = `SELECT ${table}.* ${joins} FROM ${table} ${joins} ${where.length ? 'WHERE '+where.join(' AND ') : ''} ORDER BY ${table}.${orderBy}`;
      const r = await pool.query(sql, params);
      res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // GET ONE
  router.get('/:id', async (req, res) => {
    try {
      const r = await pool.query(`SELECT * FROM ${table} WHERE id=$1`, [req.params.id]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // CREATE (admin only, handled by middleware in index)
  router.post('/', async (req, res) => {
    try {
      const data = req.body;
      const cols = fields.filter(f => data[f] !== undefined);
      if (!cols.length) return res.status(400).json({ error: 'No valid fields' });
      const vals = cols.map(f => data[f]);
      const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`;
      const r = await pool.query(sql, vals);
      res.status(201).json(r.rows[0]);
      webhook.emit(`${table}.create`, r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // UPDATE
  router.put('/:id', async (req, res) => {
    try {
      const data = req.body;
      const cols = fields.filter(f => data[f] !== undefined);
      if (!cols.length) return res.status(400).json({ error: 'No valid fields' });
      const vals = cols.map(f => data[f]);
      vals.push(req.params.id);
      const sql = `UPDATE ${table} SET ${cols.map((f,i)=>`${f}=$${i+1}`).join(',')} WHERE id=$${vals.length} RETURNING *`;
      const r = await pool.query(sql, vals);
      if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
      webhook.emit(`${table}.update`, r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // DELETE (admin only)
  router.delete('/:id', async (req, res) => {
    try {
      const r = await pool.query(`DELETE FROM ${table} WHERE id=$1 RETURNING id`, [req.params.id]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
      res.json({ deleted: req.params.id });
      webhook.emit(`${table}.delete`, { id: req.params.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
}

module.exports = crud;
