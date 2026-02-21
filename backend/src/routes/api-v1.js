/**
 * External API v1 — for third-party integrations (Make, n8n, etc.)
 * Auth: X-API-Key header
 * Base: /api/v1
 */
const router = require('express').Router();
const pool = require('../db');

// ─── Vehicles ─────────────────────────────────────────────────────────────────

/** GET /api/v1/vehicles — list vehicles (filterable) */
router.get('/vehicles', async (req, res) => {
  try {
    const { status, asset_type, q } = req.query;
    let where = [], params = [];

    if (status)     { params.push(status);     where.push(`v.status=$${params.length}`); }
    if (asset_type) { params.push(asset_type); where.push(`v.asset_type=$${params.length}`); }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(v.vehicle_number ILIKE $${params.length} OR v.nickname ILIKE $${params.length} OR v.manufacturer ILIKE $${params.length})`);
    }

    const r = await pool.query(`
      SELECT
        v.id, v.vehicle_number, v.nickname, v.asset_type, v.fuel_type, v.status,
        v.manufacturer, v.model, v.year, v.chassis_number,
        v.purchase_date, v.purchase_amount, v.eligible_diesel_refund,
        v.is_pledged, v.pledged_to, v.notes, v.created_at,
        (SELECT e.name FROM employees e
          JOIN vehicle_employees ve ON ve.employee_id=e.id
          WHERE ve.vehicle_id=v.id AND ve.is_responsible=true LIMIT 1) AS responsible_employee,
        (SELECT MIN(next_date) FROM maintenance
          WHERE vehicle_id=v.id AND next_date IS NOT NULL AND next_date >= CURRENT_DATE) AS next_maintenance_date,
        (SELECT MIN(next_inspection_date) FROM inspections
          WHERE vehicle_id=v.id AND next_inspection_date IS NOT NULL AND next_inspection_date >= CURRENT_DATE) AS next_inspection_date,
        (SELECT MIN(expiry_date) FROM insurance_policies
          WHERE vehicle_id=v.id AND status='פעילה') AS policy_expiry_date
      FROM vehicles v
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY v.vehicle_number
    `, params);

    res.json({ data: r.rows, count: r.rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /api/v1/vehicles/:id — single vehicle with full detail */
router.get('/vehicles/:id', async (req, res) => {
  try {
    const v = (await pool.query('SELECT * FROM vehicles WHERE id=$1', [req.params.id])).rows[0];
    if (!v) return res.status(404).json({ error: 'Vehicle not found' });

    const [employees, maintenance, inspections, policies] = await Promise.all([
      pool.query(`SELECT e.id, e.name, e.role, e.phone, ve.is_responsible
                  FROM employees e JOIN vehicle_employees ve ON ve.employee_id=e.id
                  WHERE ve.vehicle_id=$1`, [v.id]),
      pool.query(`SELECT m.*, g.name AS garage_name FROM maintenance m
                  LEFT JOIN garages g ON g.id=m.garage_id
                  WHERE m.vehicle_id=$1 ORDER BY m.maintenance_date DESC LIMIT 10`, [v.id]),
      pool.query(`SELECT * FROM inspections WHERE vehicle_id=$1 ORDER BY inspection_date DESC LIMIT 10`, [v.id]),
      pool.query(`SELECT * FROM insurance_policies WHERE vehicle_id=$1 ORDER BY expiry_date`, [v.id]),
    ]);

    res.json({
      ...v,
      employees: employees.rows,
      maintenance: maintenance.rows,
      inspections: inspections.rows,
      policies: policies.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Employees ────────────────────────────────────────────────────────────────

/** GET /api/v1/employees */
router.get('/employees', async (req, res) => {
  try {
    const { active, q } = req.query;
    let where = [], params = [];

    if (active !== undefined) { params.push(active === 'true'); where.push(`active=$${params.length}`); }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(name ILIKE $${params.length} OR id_number ILIKE $${params.length} OR phone ILIKE $${params.length})`);
    }

    const r = await pool.query(
      `SELECT id, name, id_number, role, phone, email, start_date, end_date, active, salary_type, notes
       FROM employees
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY name`,
      params
    );
    res.json({ data: r.rows, count: r.rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Maintenance ──────────────────────────────────────────────────────────────

/** GET /api/v1/maintenance?vehicle_id=&status=&from=&to= */
router.get('/maintenance', async (req, res) => {
  try {
    const { vehicle_id, status, from, to } = req.query;
    let where = [], params = [];

    if (vehicle_id) { params.push(vehicle_id); where.push(`m.vehicle_id=$${params.length}`); }
    if (status)     { params.push(status);     where.push(`m.status=$${params.length}`); }
    if (from)       { params.push(from);       where.push(`m.maintenance_date>=$${params.length}`); }
    if (to)         { params.push(to);         where.push(`m.maintenance_date<=$${params.length}`); }

    const r = await pool.query(
      `SELECT m.*, v.vehicle_number, v.nickname, g.name AS garage_name
       FROM maintenance m
       JOIN vehicles v ON v.id=m.vehicle_id
       LEFT JOIN garages g ON g.id=m.garage_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY m.maintenance_date DESC`,
      params
    );
    res.json({ data: r.rows, count: r.rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Inspections ──────────────────────────────────────────────────────────────

/** GET /api/v1/inspections?vehicle_id=&from=&to= */
router.get('/inspections', async (req, res) => {
  try {
    const { vehicle_id, from, to } = req.query;
    let where = [], params = [];

    if (vehicle_id) { params.push(vehicle_id); where.push(`i.vehicle_id=$${params.length}`); }
    if (from)       { params.push(from);       where.push(`i.inspection_date>=$${params.length}`); }
    if (to)         { params.push(to);         where.push(`i.inspection_date<=$${params.length}`); }

    const r = await pool.query(
      `SELECT i.*, v.vehicle_number, v.nickname
       FROM inspections i
       JOIN vehicles v ON v.id=i.vehicle_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY i.inspection_date DESC`,
      params
    );
    res.json({ data: r.rows, count: r.rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Insurance ────────────────────────────────────────────────────────────────

/** GET /api/v1/insurance?vehicle_id=&status= */
router.get('/insurance', async (req, res) => {
  try {
    const { vehicle_id, status } = req.query;
    let where = [], params = [];

    if (vehicle_id) { params.push(vehicle_id); where.push(`p.vehicle_id=$${params.length}`); }
    if (status)     { params.push(status);     where.push(`p.status=$${params.length}`); }

    const r = await pool.query(
      `SELECT p.*, v.vehicle_number, v.nickname
       FROM insurance_policies p
       JOIN vehicles v ON v.id=p.vehicle_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY p.expiry_date`,
      params
    );
    res.json({ data: r.rows, count: r.rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Dashboard / Summary ──────────────────────────────────────────────────────

/** GET /api/v1/summary — high-level stats for dashboard widgets */
router.get('/summary', async (req, res) => {
  try {
    const [vehicles, upcomingMaint, expiringInsurance, failedInspections] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) AS count FROM vehicles GROUP BY status ORDER BY status`),
      pool.query(`
        SELECT m.vehicle_id, v.vehicle_number, v.nickname, m.next_date, m.maintenance_type
        FROM maintenance m JOIN vehicles v ON v.id=m.vehicle_id
        WHERE m.next_date IS NOT NULL AND m.next_date BETWEEN CURRENT_DATE AND CURRENT_DATE+30
        ORDER BY m.next_date`),
      pool.query(`
        SELECT p.vehicle_id, v.vehicle_number, v.nickname, p.expiry_date, p.coverage_type
        FROM insurance_policies p JOIN vehicles v ON v.id=p.vehicle_id
        WHERE p.status='פעילה' AND p.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE+60
        ORDER BY p.expiry_date`),
      pool.query(`
        SELECT i.vehicle_id, v.vehicle_number, v.nickname, i.inspection_date, i.inspection_type
        FROM inspections i JOIN vehicles v ON v.id=i.vehicle_id
        WHERE i.passed=false
        ORDER BY i.inspection_date DESC LIMIT 20`),
    ]);

    res.json({
      vehicles_by_status: vehicles.rows,
      upcoming_maintenance: upcomingMaint.rows,
      expiring_insurance: expiringInsurance.rows,
      failed_inspections: failedInspections.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Fuel Cards ───────────────────────────────────────────────────────────────

/** GET /api/v1/fuel-cards?vehicle_id= */
router.get('/fuel-cards', async (req, res) => {
  try {
    const { vehicle_id } = req.query;
    let where = [], params = [];
    if (vehicle_id) { params.push(vehicle_id); where.push(`fc.vehicle_id=$${params.length}`); }

    const r = await pool.query(
      `SELECT fc.*, v.vehicle_number, v.nickname
       FROM fuel_cards fc JOIN vehicles v ON v.id=fc.vehicle_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY v.vehicle_number`,
      params
    );
    res.json({ data: r.rows, count: r.rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
