const router = require('express').Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/documents');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doc-${Date.now()}-${Math.random().toString(36).substr(2,8)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// GET with filters
router.get('/', async (req, res) => {
  try {
    const { linkedEntityType, linkedEntityId } = req.query;
    let where = []; let params = [];
    if (linkedEntityType) { params.push(linkedEntityType); where.push(`linked_entity_type=$${params.length}`); }
    if (linkedEntityId) { params.push(linkedEntityId); where.push(`linked_entity_id=$${params.length}`); }

    const r = await pool.query(`
      SELECT * FROM vehicle_documents
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY date DESC, created_at DESC
    `, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM vehicle_documents WHERE id=$1', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create (with optional file upload)
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { document_type, linked_entity_type, linked_entity_id, date, notes } = req.body;
    let file_url = req.body.file_url || null;
    if (req.file) {
      file_url = `/uploads/documents/${req.file.filename}`;
    }
    const r = await pool.query(`
      INSERT INTO vehicle_documents (document_type, linked_entity_type, linked_entity_id, file_url, date, notes)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [document_type, linked_entity_type, linked_entity_id, file_url, date, notes]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update
router.put('/:id', upload.single('file'), async (req, res) => {
  try {
    const { document_type, linked_entity_type, linked_entity_id, date, notes } = req.body;
    let file_url = req.body.file_url;
    if (req.file) {
      file_url = `/uploads/documents/${req.file.filename}`;
    }
    const r = await pool.query(`
      UPDATE vehicle_documents
      SET document_type=COALESCE($1,document_type),
          linked_entity_type=COALESCE($2,linked_entity_type),
          linked_entity_id=COALESCE($3,linked_entity_id),
          file_url=COALESCE($4,file_url),
          date=COALESCE($5,date),
          notes=COALESCE($6,notes)
      WHERE id=$7 RETURNING *
    `, [document_type, linked_entity_type, linked_entity_id, file_url, date, notes, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT file_url FROM vehicle_documents WHERE id=$1', [req.params.id]);
    if (r.rows[0]?.file_url) {
      const filePath = path.join(__dirname, '../..', r.rows[0].file_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await pool.query('DELETE FROM vehicle_documents WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
