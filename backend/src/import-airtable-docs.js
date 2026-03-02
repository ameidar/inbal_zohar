/**
 * import-airtable-docs.js
 * Imports policy documents and vehicle purchase documents from Airtable
 * into the vehicle_documents table.
 *
 * Usage:
 *   node src/import-airtable-docs.js [--dry-run]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const BASE_ID = 'appEdAzggdW0e7yEM';
const POLICIES_TABLE = 'tbljM3aqQMcNaM0lx';
const VEHICLES_TABLE = 'tblAL5Z78D4cRDBFw';

const uploadDir = path.join(__dirname, '../../uploads/documents');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'fleet_db',
  user: process.env.DB_USER || 'fleet_user',
  password: process.env.DB_PASSWORD || 'fleet123',
});

// ── helpers ──────────────────────────────────────────────────────────────────

function airtableFetch(url) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error(`JSON parse error: ${data.slice(0,200)}`)); }
      });
    }).on('error', reject);
  });
}

async function fetchAllRecords(tableId, fields) {
  const results = [];
  let offset = null;
  do {
    const params = fields.map(f => `fields[]=${encodeURIComponent(f)}`).join('&');
    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?${params}${offset ? '&offset=' + offset : ''}`;
    const data = await airtableFetch(url);
    results.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return results;
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    proto.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', (e) => { fs.unlinkSync(destPath); reject(e); });
    }).on('error', (e) => { fs.unlinkSync(destPath); reject(e); });
  });
}

function safeFilename(name) {
  return name.replace(/[^a-zA-Z0-9א-ת._-]/g, '_').replace(/__+/g, '_').slice(0, 80);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 ייבוא מסמכים מ-Airtable ${DRY_RUN ? '[DRY RUN]' : ''}\n`);

  // Build vehicle_number → DB id map
  const vRes = await pool.query('SELECT id, vehicle_number FROM vehicles');
  const vehicleMap = {}; // vehicle_number (string) → db id
  for (const v of vRes.rows) vehicleMap[String(v.vehicle_number)] = v.id;

  // Build policy_number → DB id map (number stored as text in Airtable)
  const pRes = await pool.query('SELECT id, policy_number FROM insurance_policies WHERE policy_number IS NOT NULL');
  const policyMap = {}; // policy_number (string) → db id
  for (const p of pRes.rows) policyMap[String(p.policy_number)] = p.id;

  // Check already-imported to avoid duplicates
  const existingRes = await pool.query('SELECT notes FROM vehicle_documents WHERE notes LIKE \'airtable:%\'');
  const alreadyImported = new Set(existingRes.rows.map(r => r.notes));

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // ── 1. Policy documents ────────────────────────────────────────────────────
  console.log('📄 מייבא מסמכי פוליסות...');
  const policyRecs = await fetchAllRecords(POLICIES_TABLE, ['מספר פוליסה', 'מסמך פוליסה', 'רכב']);

  for (const rec of policyRecs) {
    const f = rec.fields;
    const attachments = f['מסמך פוליסה'];
    if (!attachments || attachments.length === 0) continue;

    const policyNumRaw = f['מספר פוליסה'];
    const policyNum = policyNumRaw ? String(Math.round(policyNumRaw)) : null;
    const dbPolicyId = policyNum ? policyMap[policyNum] : null;

    // linked vehicle ids (Airtable record IDs)
    const linkedVehicleAirtableIds = f['רכב'] || [];

    for (const att of attachments) {
      const airtableKey = `airtable:policy-doc:${rec.id}:${att.id}`;
      if (alreadyImported.has(airtableKey)) { skipped++; continue; }

      const ext = path.extname(att.filename) || '.pdf';
      const fname = `doc-policy-${Date.now()}-${Math.random().toString(36).substr(2,6)}${ext}`;
      const destPath = path.join(uploadDir, fname);
      const fileUrl = `/uploads/documents/${fname}`;

      console.log(`  📎 פוליסה ${policyNum || '?'} — ${att.filename}`);

      if (!DRY_RUN) {
        try {
          await downloadFile(att.url, destPath);
          await pool.query(
            `INSERT INTO vehicle_documents (document_type, linked_entity_type, linked_entity_id, file_url, notes)
             VALUES ($1,$2,$3,$4,$5)`,
            [
              'פוליסת ביטוח',
              dbPolicyId ? 'insurance_policy' : 'vehicle',
              dbPolicyId || null,
              fileUrl,
              airtableKey,
            ]
          );
          imported++;
        } catch (e) {
          console.error(`    ❌ שגיאה: ${e.message}`);
          errors++;
        }
      } else {
        imported++;
      }
    }
  }

  // ── 2. Vehicle purchase documents ─────────────────────────────────────────
  console.log('\n📄 מייבא מסמכי רכישה לרכבים...');
  const vehicleRecs = await fetchAllRecords(VEHICLES_TABLE, ['מספר רכב', 'מסמכי רכישה']);

  for (const rec of vehicleRecs) {
    const f = rec.fields;
    const attachments = f['מסמכי רכישה'];
    if (!attachments || attachments.length === 0) continue;

    const vehicleNum = f['מספר רכב'] ? String(f['מספר רכב']) : null;
    const dbVehicleId = vehicleNum ? vehicleMap[vehicleNum] : null;

    if (!dbVehicleId) {
      console.log(`  ⚠️  רכב ${vehicleNum || '?'} לא נמצא ב-DB — מדלג`);
      skipped++;
      continue;
    }

    for (const att of attachments) {
      const airtableKey = `airtable:vehicle-doc:${rec.id}:${att.id}`;
      if (alreadyImported.has(airtableKey)) { skipped++; continue; }

      const ext = path.extname(att.filename) || '.pdf';
      const fname = `doc-vehicle-${Date.now()}-${Math.random().toString(36).substr(2,6)}${ext}`;
      const destPath = path.join(uploadDir, fname);
      const fileUrl = `/uploads/documents/${fname}`;

      console.log(`  📎 רכב ${vehicleNum} — ${att.filename}`);

      if (!DRY_RUN) {
        try {
          await downloadFile(att.url, destPath);
          await pool.query(
            `INSERT INTO vehicle_documents (document_type, linked_entity_type, linked_entity_id, file_url, notes)
             VALUES ($1,$2,$3,$4,$5)`,
            ['מסמכי רכישה', 'vehicle', dbVehicleId, fileUrl, airtableKey]
          );
          imported++;
        } catch (e) {
          console.error(`    ❌ שגיאה: ${e.message}`);
          errors++;
        }
      } else {
        imported++;
      }
    }
  }

  console.log(`\n✅ סיכום:`);
  console.log(`   ייובאו:  ${imported} מסמכים`);
  console.log(`   דולגו:   ${skipped} (כבר קיימים / לא נמצאו)`);
  console.log(`   שגיאות:  ${errors}`);

  await pool.end();
}

main().catch(e => { console.error('💥 Fatal:', e.message); process.exit(1); });
