#!/usr/bin/env node
/**
 * Import vehicle images from Airtable into local storage
 * Downloads images and updates image_url in the DB
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const pool = require('./db');

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || '';
const BASE_ID = 'appEdAzggdW0e7yEM';
const TABLE_ID = 'tblAL5Z78D4cRDBFw';

const IMG_DIR = path.join(__dirname, '../../backend/uploads/vehicle-images');
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    const req = proto.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(destPath)));
    });
    req.on('error', e => { fs.unlink(destPath, () => {}); reject(e); });
    file.on('error', e => { fs.unlink(destPath, () => {}); reject(e); });
  });
}

async function fetchAllAirtableRecords() {
  const records = [];
  let offset = null;
  const headers = { Authorization: `Bearer ${AIRTABLE_TOKEN}` };

  do {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?fields%5B%5D=%D7%9E%D7%A1%D7%A4%D7%A8+%D7%A8%D7%9B%D7%91&fields%5B%5D=%D7%AA%D7%9E%D7%95%D7%A0%D7%95%D7%AA${offset ? '&offset=' + offset : ''}`;
    const data = await fetchJson(url, headers);
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    records.push(...data.records);
    offset = data.offset;
    console.log(`  Fetched ${records.length} records so far...`);
    if (offset) await new Promise(r => setTimeout(r, 200)); // rate limit
  } while (offset);

  return records;
}

async function main() {
  console.log('🚛 Fetching vehicles from Airtable...');
  const records = await fetchAllAirtableRecords();
  console.log(`✅ Got ${records.length} Airtable records`);

  // Get all vehicles from DB
  const dbVehicles = (await pool.query('SELECT id, vehicle_number FROM vehicles')).rows;
  const dbMap = Object.fromEntries(dbVehicles.map(v => [String(v.vehicle_number), v.id]));
  console.log(`📦 ${dbVehicles.length} vehicles in DB`);

  let matched = 0, downloaded = 0, skipped = 0, noImage = 0;

  for (const rec of records) {
    const fields = rec.fields;
    const vehicleNum = String(fields['מספר רכב'] || '').trim();
    const images = fields['תמונות'];

    if (!vehicleNum) { skipped++; continue; }
    if (!images || images.length === 0) { noImage++; console.log(`  ⚠️  ${vehicleNum}: אין תמונה`); continue; }

    const vehicleId = dbMap[vehicleNum];
    if (!vehicleId) { console.log(`  ❓ ${vehicleNum}: לא נמצא ב-DB`); skipped++; continue; }

    matched++;
    const imgAttachment = images[0]; // take first image
    const imgUrl = imgAttachment.url;

    // Determine extension from URL or type
    const ext = imgAttachment.type?.includes('png') ? '.png' : '.jpg';
    const filename = `${vehicleNum}${ext}`;
    const destPath = path.join(IMG_DIR, filename);
    const servePath = `/uploads/vehicle-images/${filename}`;

    try {
      console.log(`  📥 ${vehicleNum}: מוריד תמונה (${imgAttachment.width}x${imgAttachment.height})...`);
      await downloadFile(imgUrl, destPath);
      await pool.query('UPDATE vehicles SET image_url=$1 WHERE id=$2', [servePath, vehicleId]);
      downloaded++;
      console.log(`  ✅ ${vehicleNum}: נשמר → ${servePath}`);
    } catch (e) {
      console.error(`  ❌ ${vehicleNum}: שגיאה בהורדה: ${e.message}`);
    }
  }

  console.log('\n📊 סיכום:');
  console.log(`  הורדתי: ${downloaded}/${matched} תמונות`);
  console.log(`  ללא תמונה: ${noImage}`);
  console.log(`  לא נמצא ב-DB: ${skipped}`);

  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
