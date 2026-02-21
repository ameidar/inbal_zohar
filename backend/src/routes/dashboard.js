const router = require('express').Router();
const pool = require('../db');

// Vehicle dashboard with computed fields
router.get('/vehicles', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        v.*,
        -- next maintenance
        (SELECT MIN(next_date) FROM maintenance WHERE vehicle_id=v.id AND next_date IS NOT NULL) as next_maintenance_date,
        -- next inspection
        (SELECT MIN(next_inspection_date) FROM inspections WHERE vehicle_id=v.id AND next_inspection_date IS NOT NULL) as next_inspection_date,
        -- policy expiry
        (SELECT MIN(expiry_date) FROM insurance_policies WHERE vehicle_id=v.id AND status='פעילה') as policy_expiry_date,
        -- responsible employee
        (SELECT e.name FROM employees e JOIN vehicle_employees ve ON ve.employee_id=e.id WHERE ve.vehicle_id=v.id AND ve.is_responsible=true LIMIT 1) as responsible_employee,
        -- fuel card count
        (SELECT COUNT(*) FROM fuel_cards WHERE vehicle_id=v.id AND status='פעיל')::int as active_fuel_cards,
        -- pending payments
        (SELECT COUNT(*) FROM insurance_payments ip JOIN insurance_policies pol ON pol.id=ip.policy_id WHERE pol.vehicle_id=v.id AND ip.status='פתוח' AND ip.charge_date <= CURRENT_DATE)::int as overdue_payments,
        -- has mandatory insurance
        EXISTS(SELECT 1 FROM insurance_policies WHERE vehicle_id=v.id AND status='פעילה' AND coverage_type IN ('חובה','חובה + מקיף','חובה + צד ג'''))::boolean as has_mandatory,
        -- has comprehensive insurance
        EXISTS(SELECT 1 FROM insurance_policies WHERE vehicle_id=v.id AND status='פעילה' AND coverage_type IN ('מקיף','חובה + מקיף'))::boolean as has_comprehensive
      FROM vehicles v
      ORDER BY v.vehicle_number
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Alerts: vehicles needing attention
router.get('/alerts', async (req, res) => {
  try {
    const alerts = [];
    const threshold = 30;

    // Expiring policies (< 30 days)
    const expPol = await pool.query(`
      SELECT v.vehicle_number, v.nickname, p.coverage_type, p.insurer, p.expiry_date,
        (p.expiry_date - CURRENT_DATE) as days_left
      FROM insurance_policies p
      JOIN vehicles v ON v.id=p.vehicle_id
      WHERE p.status='פעילה' AND p.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${threshold} days'
      ORDER BY p.expiry_date
    `);
    expPol.rows.forEach(r => alerts.push({ type: 'policy_expiry', severity: r.days_left <= 7 ? 'high' : 'medium', vehicle: r.vehicle_number, nickname: r.nickname, message: `פוליסת ${r.coverage_type} (${r.insurer}) פגה בעוד ${r.days_left} ימים`, date: r.expiry_date }));

    // Overdue inspections
    const overInsp = await pool.query(`
      SELECT v.vehicle_number, v.nickname, i.next_inspection_date, i.inspection_type,
        (CURRENT_DATE - i.next_inspection_date) as days_overdue
      FROM inspections i
      JOIN vehicles v ON v.id=i.vehicle_id
      WHERE i.next_inspection_date < CURRENT_DATE
      ORDER BY i.next_inspection_date
    `);
    overInsp.rows.forEach(r => alerts.push({ type: 'inspection_overdue', severity: 'high', vehicle: r.vehicle_number, nickname: r.nickname, message: `${r.inspection_type} באיחור של ${r.days_overdue} ימים`, date: r.next_inspection_date }));

    // Upcoming inspections (< 30 days)
    const upInsp = await pool.query(`
      SELECT v.vehicle_number, v.nickname, i.next_inspection_date, i.inspection_type,
        (i.next_inspection_date - CURRENT_DATE) as days_left
      FROM inspections i
      JOIN vehicles v ON v.id=i.vehicle_id
      WHERE i.next_inspection_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${threshold} days'
      ORDER BY i.next_inspection_date
    `);
    upInsp.rows.forEach(r => alerts.push({ type: 'inspection_upcoming', severity: 'low', vehicle: r.vehicle_number, nickname: r.nickname, message: `${r.inspection_type} בעוד ${r.days_left} ימים`, date: r.next_inspection_date }));

    // No responsible employee
    const noResp = await pool.query(`
      SELECT v.vehicle_number, v.nickname
      FROM vehicles v
      WHERE v.status='פעיל'
      AND NOT EXISTS (SELECT 1 FROM vehicle_employees ve WHERE ve.vehicle_id=v.id AND ve.is_responsible=true)
    `);
    noResp.rows.forEach(r => alerts.push({ type: 'no_responsible', severity: 'medium', vehicle: r.vehicle_number, nickname: r.nickname, message: 'אין עובד אחראי משויך' }));

    // No fuel card
    const noFuel = await pool.query(`
      SELECT v.vehicle_number, v.nickname
      FROM vehicles v
      WHERE v.status='פעיל' AND v.fuel_type != 'אחר'
      AND NOT EXISTS (SELECT 1 FROM fuel_cards fc WHERE fc.vehicle_id=v.id AND fc.status='פעיל')
    `);
    noFuel.rows.forEach(r => alerts.push({ type: 'no_fuel_card', severity: 'medium', vehicle: r.vehicle_number, nickname: r.nickname, message: 'אין כרטיס דלק פעיל' }));

    // Overdue insurance payments
    const overPay = await pool.query(`
      SELECT v.vehicle_number, v.nickname, COUNT(*) as count
      FROM insurance_payments ip
      JOIN insurance_policies pol ON pol.id=ip.policy_id
      JOIN vehicles v ON v.id=pol.vehicle_id
      WHERE ip.status='פתוח' AND ip.charge_date < CURRENT_DATE
      GROUP BY v.vehicle_number, v.nickname
    `);
    overPay.rows.forEach(r => alerts.push({ type: 'overdue_payment', severity: 'high', vehicle: r.vehicle_number, nickname: r.nickname, message: `${r.count} תשלומי ביטוח באיחור` }));

    res.json(alerts.sort((a,b) => {
      const s = { high: 0, medium: 1, low: 2 };
      return s[a.severity] - s[b.severity];
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Stats
router.get('/stats', async (req, res) => {
  try {
    const [vehicles, employees, pendingPayments, activePolicies, openMaintenance] = await Promise.all([
      pool.query(`SELECT status, COUNT(*)::int as cnt FROM vehicles GROUP BY status`),
      pool.query(`SELECT COUNT(*)::int as cnt FROM employees WHERE active=true`),
      pool.query(`SELECT COUNT(*)::int as cnt FROM insurance_payments WHERE status='פתוח' AND charge_date <= CURRENT_DATE + INTERVAL '30 days'`),
      pool.query(`SELECT COUNT(*)::int as cnt FROM insurance_policies WHERE status='פעילה'`),
      pool.query(`SELECT COUNT(*)::int as cnt FROM maintenance WHERE status='פתוח'`)
    ]);
    res.json({
      vehicles_by_status: vehicles.rows,
      active_employees: employees.rows[0]?.cnt || 0,
      pending_payments_30d: pendingPayments.rows[0]?.cnt || 0,
      active_policies: activePolicies.rows[0]?.cnt || 0,
      open_maintenance: openMaintenance.rows[0]?.cnt || 0
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Financial dashboard
router.get('/financial', async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month } = req.query;

    // Insurance payments this month
    const insPayments = await pool.query(`
      SELECT 
        TO_CHAR(charge_date, 'YYYY-MM') as period,
        SUM(expected_amount)::numeric as expected,
        SUM(CASE WHEN status != 'פתוח' THEN actual_amount ELSE 0 END)::numeric as paid,
        COUNT(*)::int as count
      FROM insurance_payments
      WHERE EXTRACT(year FROM charge_date) = $1
      ${month ? 'AND EXTRACT(month FROM charge_date) = $2' : ''}
      GROUP BY period ORDER BY period`, month ? [year, month] : [year]);

    // Fuel costs per month
    const fuelCosts = await pool.query(`
      SELECT period, SUM(total_amount)::numeric as total FROM fuel_invoices
      WHERE period LIKE $1
      GROUP BY period ORDER BY period`, [`${year}-%`]);

    // Maintenance costs per month
    const mainCosts = await pool.query(`
      SELECT TO_CHAR(maintenance_date,'YYYY-MM') as period, SUM(cost)::numeric as total
      FROM maintenance WHERE EXTRACT(year FROM maintenance_date)=$1 AND status='בוצע'
      GROUP BY period ORDER BY period`, [year]);

    res.json({ insurance_payments: insPayments.rows, fuel_costs: fuelCosts.rows, maintenance_costs: mainCosts.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Monthly finance detail (for Finance page)
router.get('/monthly', async (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    const periodStr = `${year}-${String(month).padStart(2, '0')}`;

    // Insurance payments for the month (with policy + vehicle info)
    const ins = await pool.query(`
      SELECT
        ip.id, ip.payment_number, ip.charge_date, ip.expected_amount, ip.actual_amount,
        ip.status, pol.policy_number, pol.coverage_type, pol.insurer,
        v.vehicle_number, v.nickname, pm.name as payment_method_name
      FROM insurance_payments ip
      JOIN insurance_policies pol ON pol.id = ip.policy_id
      JOIN vehicles v ON v.id = pol.vehicle_id
      LEFT JOIN payment_methods pm ON pm.id = pol.payment_method_id
      WHERE EXTRACT(year FROM ip.charge_date) = $1
        AND EXTRACT(month FROM ip.charge_date) = $2
      ORDER BY ip.charge_date, v.vehicle_number
    `, [year, month]);

    // Fuel invoices for the month
    const fuel = await pool.query(`
      SELECT id, supplier, period, total_amount, created_at
      FROM fuel_invoices
      WHERE period = $1
      ORDER BY created_at DESC
    `, [periodStr]);

    // Maintenance costs for the month (completed)
    const maint = await pool.query(`
      SELECT m.id, m.maintenance_date, m.maintenance_type, m.cost, m.description,
             v.vehicle_number, v.nickname, g.name as garage_name
      FROM maintenance m
      JOIN vehicles v ON v.id = m.vehicle_id
      LEFT JOIN garages g ON g.id = m.garage_id
      WHERE EXTRACT(year FROM m.maintenance_date) = $1
        AND EXTRACT(month FROM m.maintenance_date) = $2
        AND m.status = 'בוצע'
      ORDER BY m.maintenance_date
    `, [year, month]);

    // Summary
    const insTotal = ins.rows.reduce((s, r) => s + (parseFloat(r.expected_amount) || 0), 0);
    const insPaid = ins.rows.reduce((s, r) => s + (r.status !== 'פתוח' ? parseFloat(r.actual_amount) || 0 : 0), 0);
    const fuelTotal = fuel.rows.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0);
    const maintTotal = maint.rows.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);

    res.json({
      year, month, period: periodStr,
      summary: { insurance_expected: insTotal, insurance_paid: insPaid, fuel_total: fuelTotal, maintenance_total: maintTotal },
      insurance_payments: ins.rows,
      fuel_invoices: fuel.rows,
      maintenance_costs: maint.rows
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
