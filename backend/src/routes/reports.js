/**
 * GET /api/reports/diesel-consumption  — סולר לפי רכב ותקופה
 * GET /api/reports/diesel-refunds      — החזרי סולר לפי רכב
 * GET /api/reports/sonol-summary       — סיכום חשבוניות סונול לפי כרטיס/תקופה
 */

const router = require('express').Router();
const pool = require('../db');

// ── Diesel consumption: liters by vehicle per period ─────────────────────────
router.get('/diesel-consumption', async (req, res) => {
  try {
    const { from, to } = req.query; // YYYY-MM
    let where = ["fil.fuel_type IN ('סולר','diesel')"];
    const params = [];
    if (from) { params.push(from); where.push(`fil.period >= $${params.length}`); }
    if (to)   { params.push(to);   where.push(`fil.period <= $${params.length}`); }

    const r = await pool.query(`
      SELECT
        v.id as vehicle_id,
        v.vehicle_number,
        v.nickname,
        v.eligible_diesel_refund,
        SUM(fil.liters)::numeric as total_liters,
        SUM(fil.amount)::numeric as total_amount,
        COUNT(DISTINCT fil.period) as period_count,
        STRING_AGG(DISTINCT fil.period, ', ' ORDER BY fil.period) as periods,
        MIN(fil.period) as period_from,
        MAX(fil.period) as period_to
      FROM fuel_invoice_lines fil
      INNER JOIN vehicles v ON v.id = fil.vehicle_id
      WHERE ${where.join(' AND ')}
      GROUP BY v.id, v.vehicle_number, v.nickname, v.eligible_diesel_refund
      ORDER BY total_liters DESC
    `, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Diesel consumption by period summary ─────────────────────────────────────
router.get('/diesel-by-period', async (req, res) => {
  try {
    const { from, to } = req.query;
    let where = ["fil.fuel_type IN ('סולר','diesel')"];
    const params = [];
    if (from) { params.push(from); where.push(`fil.period >= $${params.length}`); }
    if (to)   { params.push(to);   where.push(`fil.period <= $${params.length}`); }

    const r = await pool.query(`
      SELECT
        fil.period,
        v.vehicle_number,
        v.nickname,
        SUM(fil.liters)::numeric as liters,
        SUM(fil.amount)::numeric as amount,
        v.eligible_diesel_refund
      FROM fuel_invoice_lines fil
      INNER JOIN vehicles v ON v.id = fil.vehicle_id
      WHERE ${where.join(' AND ')}
      GROUP BY fil.period, v.id, v.vehicle_number, v.nickname, v.eligible_diesel_refund
      ORDER BY fil.period DESC, liters DESC
    `, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Diesel refund report ──────────────────────────────────────────────────────
router.get('/diesel-refunds', async (req, res) => {
  try {
    const { vehicle_id, status, from, to } = req.query;
    let where = [];
    const params = [];
    if (vehicle_id) { params.push(vehicle_id); where.push(`dr.vehicle_id=$${params.length}`); }
    if (status)     { params.push(status);     where.push(`dr.refund_status=$${params.length}`); }
    if (from)       { params.push(from);       where.push(`dr.period>=$${params.length}`); }
    if (to)         { params.push(to);         where.push(`dr.period<=$${params.length}`); }

    const r = await pool.query(`
      SELECT
        dr.*,
        v.vehicle_number, v.nickname, v.eligible_diesel_refund
      FROM diesel_refunds dr
      LEFT JOIN vehicles v ON v.id = dr.vehicle_id
      ${where.length ? 'WHERE '+where.join(' AND ') : ''}
      ORDER BY dr.period DESC, v.vehicle_number
    `, params);

    // Summary
    const summary = await pool.query(`
      SELECT
        v.vehicle_number, v.nickname,
        SUM(dr.liters)::numeric as total_liters,
        SUM(dr.amount)::numeric as total_amount,
        COUNT(*) as records,
        COUNT(CASE WHEN dr.refund_status='התקבל' THEN 1 END) as received_count
      FROM diesel_refunds dr
      LEFT JOIN vehicles v ON v.id = dr.vehicle_id
      GROUP BY v.id, v.vehicle_number, v.nickname
      ORDER BY total_amount DESC
    `);

    res.json({ rows: r.rows, summary: summary.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Eligible vehicles for diesel refund ──────────────────────────────────────
router.get('/diesel-eligible', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        v.id, v.vehicle_number, v.nickname, v.fuel_type,
        COALESCE(SUM(fil.liters),0)::numeric as total_liters_all_time,
        COALESCE(SUM(fil.amount),0)::numeric as total_amount_all_time,
        COALESCE(SUM(dr.amount),0)::numeric as total_refunds_received
      FROM vehicles v
      LEFT JOIN fuel_invoice_lines fil ON fil.vehicle_id=v.id AND fil.fuel_type IN ('סולר','diesel')
      LEFT JOIN diesel_refunds dr ON dr.vehicle_id=v.id AND dr.refund_status='התקבל'
      WHERE v.eligible_diesel_refund=true
      GROUP BY v.id, v.vehicle_number, v.nickname, v.fuel_type
      ORDER BY total_liters_all_time DESC
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
