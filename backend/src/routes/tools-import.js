/**
 * POST /api/tools/import-excel
 * Imports tools from an Excel file.
 * Accepts multipart/form-data with a single "file" field.
 * Query param: ?dry_run=1 for preview without inserting.
 * Expected columns (case-insensitive, Hebrew or English):
 *   מספר סידורי / serial_number  (required)
 *   סוג כלי / tool_type
 *   קטגוריה / category
 *   רכב / vehicle_number
 *   סטטוס / status
 *   הערות / notes
 */

const router = require('express').Router();
const pool = require('../db');
const multer = require('multer');
const XLSX = require('xlsx');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Column name normalization map (Hebrew → internal key)
const COL_MAP = {
  'מספר סידורי': 'serial_number', 'serial_number': 'serial_number', 'serial': 'serial_number',
  'סוג כלי': 'tool_type', 'tool_type': 'tool_type', 'סוג': 'tool_type',
  'קטגוריה': 'category', 'category': 'category',
  'רכב': 'vehicle_number', 'vehicle_number': 'vehicle_number', 'מספר רכב': 'vehicle_number',
  'סטטוס': 'status', 'status': 'status',
  'הערות': 'notes', 'notes': 'notes',
  'בדיקה נדרשת': 'requires_inspection', 'requires_inspection': 'requires_inspection',
};

function normalizeRow(rawRow) {
  const result = {};
  for (const [key, val] of Object.entries(rawRow)) {
    const norm = COL_MAP[key.trim()] || COL_MAP[key.trim().toLowerCase()];
    if (norm) result[norm] = val !== undefined && val !== null ? String(val).trim() : '';
  }
  return result;
}

router.post('/import-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const isDryRun = req.query.dry_run === '1';

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) return res.status(400).json({ error: 'הגיליון ריק' });

    // Normalize columns
    const normalized = rows.map(normalizeRow);

    // Load lookup maps
    const [vehiclesRes, categoriesRes, existingRes] = await Promise.all([
      pool.query('SELECT id, vehicle_number FROM vehicles'),
      pool.query('SELECT id, name FROM tool_categories'),
      pool.query('SELECT serial_number FROM tools'),
    ]);
    const vehicleMap = {}; // vehicle_number → id
    vehiclesRes.rows.forEach(v => { vehicleMap[String(v.vehicle_number)] = v.id; });
    const categoryMap = {}; // name → id
    categoriesRes.rows.forEach(c => { categoryMap[c.name.toLowerCase()] = c.id; });
    const existingSerials = new Set(existingRes.rows.map(t => t.serial_number));

    const preview = [];
    const errors = [];

    for (let i = 0; i < normalized.length; i++) {
      const row = normalized[i];
      const rowNum = i + 2; // 1-indexed + header row

      if (!row.serial_number) {
        errors.push({ row: rowNum, error: 'חסר מספר סידורי' });
        continue;
      }

      const existing = existingSerials.has(row.serial_number);
      const vehicle_id = row.vehicle_number ? vehicleMap[row.vehicle_number] || null : null;
      const category_id = row.category
        ? (categoryMap[row.category.toLowerCase()] || null)
        : null;

      preview.push({
        rowNum,
        serial_number: row.serial_number,
        tool_type: row.tool_type || null,
        vehicle_number: row.vehicle_number || null,
        vehicle_id,
        category: row.category || null,
        category_id,
        status: row.status || 'פעיל',
        notes: row.notes || null,
        requires_inspection: row.requires_inspection === 'כן' || row.requires_inspection === 'true' || row.requires_inspection === '1',
        action: existing ? 'skip' : 'insert',
        warning: vehicle_id === null && row.vehicle_number ? `רכב ${row.vehicle_number} לא נמצא` : null,
      });
    }

    if (isDryRun) {
      return res.json({
        total: normalized.length,
        to_insert: preview.filter(p => p.action === 'insert').length,
        to_skip: preview.filter(p => p.action === 'skip').length,
        errors: errors.length,
        preview: preview.slice(0, 50),
        errors_detail: errors,
      });
    }

    // Execute import
    let inserted = 0;
    let skipped = 0;
    for (const item of preview) {
      if (item.action === 'skip') { skipped++; continue; }
      try {
        await pool.query(
          `INSERT INTO tools (serial_number, tool_type, vehicle_id, category_id, status, notes, requires_inspection)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (serial_number) DO NOTHING`,
          [item.serial_number, item.tool_type, item.vehicle_id, item.category_id, item.status, item.notes, item.requires_inspection]
        );
        inserted++;
      } catch (e) {
        errors.push({ row: item.rowNum, error: e.message });
      }
    }

    res.json({ inserted, skipped, errors: errors.length, errors_detail: errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
