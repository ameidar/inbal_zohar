const router = require('express').Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/purchase-docs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `vehicle-${req.params.id}-purchase-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

const FIELDS = ['vehicle_number','nickname','asset_type','fuel_type','status','manufacturer','model','year','chassis_number','purchase_date','purchase_amount','purchase_payment_method','purchase_num_payments','purchase_doc_url','eligible_diesel_refund','is_pledged','pledged_to','image_url','notes'];

router.get('/', async (req, res) => {
  try {
    const { status, asset_type, q } = req.query;
    let where = []; let params = [];
    if (status) { params.push(status); where.push(`v.status=$${params.length}`); }
    if (asset_type) { params.push(asset_type); where.push(`v.asset_type=$${params.length}`); }
    if (q) { params.push(`%${q}%`); where.push(`(v.vehicle_number ILIKE $${params.length} OR v.nickname ILIKE $${params.length} OR v.manufacturer ILIKE $${params.length})`); }
    const r = await pool.query(`
      SELECT v.*,
        (SELECT e.name FROM employees e JOIN vehicle_employees ve ON ve.employee_id=e.id WHERE ve.vehicle_id=v.id AND ve.is_responsible=true LIMIT 1) as responsible_employee,
        (SELECT MIN(next_date) FROM maintenance WHERE vehicle_id=v.id AND next_date IS NOT NULL AND next_date >= CURRENT_DATE) as next_maintenance_date,
        (SELECT MIN(next_inspection_date) FROM inspections WHERE vehicle_id=v.id AND next_inspection_date IS NOT NULL AND next_inspection_date >= CURRENT_DATE) as next_inspection_date,
        (SELECT MIN(expiry_date) FROM insurance_policies WHERE vehicle_id=v.id AND status='פעילה') as policy_expiry_date,
        EXISTS(SELECT 1 FROM insurance_policies WHERE vehicle_id=v.id AND status='פעילה' AND coverage_type IN ('חובה','חובה + מקיף','חובה + צד ג'''))::boolean as has_mandatory,
        EXISTS(SELECT 1 FROM insurance_policies WHERE vehicle_id=v.id AND status='פעילה' AND coverage_type IN ('מקיף','חובה + מקיף'))::boolean as has_comprehensive
      FROM vehicles v
      ${where.length ? 'WHERE '+where.join(' AND ') : ''}
      ORDER BY v.vehicle_number
    `, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const v = (await pool.query('SELECT * FROM vehicles WHERE id=$1', [req.params.id])).rows[0];
    if (!v) return res.status(404).json({ error: 'Not found' });
    const [employees, maintenance, inspections, fuelCards, policies, security, tools, dieselRefunds] = await Promise.all([
      pool.query(`SELECT e.*, ve.is_responsible FROM employees e JOIN vehicle_employees ve ON ve.employee_id=e.id WHERE ve.vehicle_id=$1`, [req.params.id]),
      pool.query(`SELECT m.*, g.name as garage_name FROM maintenance m LEFT JOIN garages g ON g.id=m.garage_id WHERE m.vehicle_id=$1 ORDER BY m.maintenance_date DESC LIMIT 10`, [req.params.id]),
      pool.query(`SELECT * FROM inspections WHERE vehicle_id=$1 ORDER BY inspection_date DESC`, [req.params.id]),
      pool.query(`SELECT * FROM fuel_cards WHERE vehicle_id=$1`, [req.params.id]),
      pool.query(`SELECT * FROM insurance_policies WHERE vehicle_id=$1 ORDER BY expiry_date`, [req.params.id]),
      pool.query(`SELECT vs.*, sc.name as company_name FROM vehicle_security vs LEFT JOIN security_companies sc ON sc.id=vs.company_id WHERE vs.vehicle_id=$1`, [req.params.id]),
      pool.query(`SELECT * FROM tools WHERE vehicle_id=$1`, [req.params.id]),
      pool.query(`SELECT * FROM diesel_refunds WHERE vehicle_id=$1 ORDER BY period DESC`, [req.params.id])
    ]);
    res.json({ ...v, employees: employees.rows, maintenance: maintenance.rows, inspections: inspections.rows, fuel_cards: fuelCards.rows, policies: policies.rows, security: security.rows, tools: tools.rows, diesel_refunds: dieselRefunds.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const cols = FIELDS.filter(f => data[f] !== undefined);
    const vals = cols.map(f => data[f]);
    const r = await pool.query(`INSERT INTO vehicles (${cols.join(',')}) VALUES (${cols.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`, vals);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const data = req.body;
    const cols = FIELDS.filter(f => data[f] !== undefined);
    if (!cols.length) return res.status(400).json({ error: 'No fields' });
    const vals = [...cols.map(f => data[f]), req.params.id];
    const r = await pool.query(`UPDATE vehicles SET ${cols.map((f,i)=>`${f}=$${i+1}`).join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM vehicles WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: req.params.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Assign/remove employee
router.post('/:id/employees', async (req, res) => {
  try {
    const { employee_id, is_responsible } = req.body;
    await pool.query(`INSERT INTO vehicle_employees (vehicle_id, employee_id, is_responsible) VALUES ($1,$2,$3) ON CONFLICT (vehicle_id, employee_id) DO UPDATE SET is_responsible=$3`, [req.params.id, employee_id, is_responsible || false]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/employees/:eid', async (req, res) => {
  try {
    await pool.query('DELETE FROM vehicle_employees WHERE vehicle_id=$1 AND employee_id=$2', [req.params.id, req.params.eid]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Upload purchase document
router.post('/:id/purchase-doc', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const docUrl = `/uploads/purchase-docs/${req.file.filename}`;
    await pool.query('UPDATE vehicles SET purchase_doc_url=$1 WHERE id=$2', [docUrl, req.params.id]);
    res.json({ url: docUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
