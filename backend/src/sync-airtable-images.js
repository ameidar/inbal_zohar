/**
 * Airtable → Fleet: sync vehicle images
 * Usage: node src/sync-airtable-images.js [--dry-run]
 *
 * Pulls the רכבים table from Airtable, matches vehicles by מספר רכב,
 * downloads the first image to uploads/vehicles/, and updates image_url in DB.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const pool = require('./db');

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const BASE_ID = 'appEdAzggdW0e7yEM';
const TABLE_ID = 'tblAL5Z78D4cRDBFw'; // רכבים
const UPLOADS_DIR = path.join(__dirname, '../uploads/vehicles');
const DRY_RUN = process.argv.includes('--dry-run');

if (!AIRTABLE_TOKEN) {
  console.error('❌ AIRTABLE_API_KEY not set in .env');
  process.exit(1);
}

if (DRY_RUN) console.log('🔍 DRY RUN — לא כותב לשום מקום\n');

// ── helpers ───────────────────────────────────────────────────────────────────

function airtableFetch(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + data)); }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, (res) => {
      // follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function sanitizeFilename(str) {
  return str.replace(/[^a-zA-Z0-9\u0590-\u05FF._-]/g, '_');
}

// ── fetch all Airtable records (paginate) ────────────────────────────────────

async function fetchAllRecords() {
  const records = [];
  let offset = null;

  do {
    const url =
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}` +
      `?fields%5B%5D=%D7%9E%D7%A1%D7%A4%D7%A8+%D7%A8%D7%9B%D7%91` + // מספר רכב
      `&fields%5B%5D=%D7%AA%D7%9E%D7%95%D7%A0%D7%95%D7%AA` +          // תמונות
      (offset ? `&offset=${offset}` : '');

    const data = await airtableFetch(url);
    if (data.error) throw new Error('Airtable error: ' + JSON.stringify(data.error));
    records.push(...(data.records || []));
    offset = data.offset || null;
  } while (offset);

  return records;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📡 מושך רשומות מ-Airtable...');
  const records = await fetchAllRecords();
  console.log(`   נמצאו ${records.length} רכבים ב-Airtable\n`);

  if (!DRY_RUN) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  let updated = 0, skipped = 0, notFound = 0;

  for (const rec of records) {
    const vehicleNumber = rec.fields['מספר רכב'];
    const images = rec.fields['תמונות'];

    if (!vehicleNumber) { skipped++; continue; }
    if (!images || images.length === 0) {
      console.log(`⚪ ${vehicleNumber} — אין תמונות ב-Airtable`);
      skipped++;
      continue;
    }

    // match in DB
    const dbRes = await pool.query(
      'SELECT id, image_url FROM vehicles WHERE vehicle_number = $1',
      [vehicleNumber]
    );

    if (dbRes.rows.length === 0) {
      console.log(`❓ ${vehicleNumber} — לא נמצא ב-DB`);
      notFound++;
      continue;
    }

    const vehicle = dbRes.rows[0];
    const img = images[0]; // take first image
    const ext = path.extname(img.filename) || '.jpg';
    const filename = `${sanitizeFilename(vehicleNumber)}${ext}`;
    const localPath = path.join(UPLOADS_DIR, filename);
    const publicUrl = `/uploads/vehicles/${filename}`;

    if (DRY_RUN) {
      console.log(`✅ [DRY] ${vehicleNumber} → ${publicUrl} (${img.filename})`);
      updated++;
      continue;
    }

    try {
      await downloadFile(img.url, localPath);
      await pool.query(
        'UPDATE vehicles SET image_url = $1 WHERE id = $2',
        [publicUrl, vehicle.id]
      );
      console.log(`✅ ${vehicleNumber} → ${publicUrl}`);
      updated++;
    } catch (err) {
      console.error(`❌ ${vehicleNumber} — שגיאה: ${err.message}`);
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
סיכום:
  עודכנו:      ${updated}
  דולגו:       ${skipped}
  לא נמצאו:   ${notFound}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  await pool.end();
}

main().catch((e) => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});
