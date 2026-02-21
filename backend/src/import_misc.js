/**
 * Import: security, garages, fuel_cards
 * node src/import_misc.js data/security.csv data/garages.csv data/fuel_cards.csv
 */
const fs = require('fs');
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost', port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fleet_db', user: process.env.DB_USER || 'fleet_user',
  password: process.env.DB_PASSWORD || 'fleet123',
});

function parseDate(s) {
  if (!s || !s.trim()) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
}

function parseLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++; } else inQ=!inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur=''; }
    else cur += c;
  }
  result.push(cur); return result;
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const row = {};
    headers.forEach((h,i) => { row[h.trim()] = (vals[i]||'').trim(); });
    return row;
  });
}

async function run() {
  const [secPath, garPath, fuelPath] = process.argv.slice(2);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Vehicle map ──────────────────────────
    const vRes = await client.query('SELECT id, vehicle_number FROM vehicles');
    const vMap = {};
    vRes.rows.forEach(r => { vMap[r.vehicle_number] = r.id; });

    // ── 1. Security companies + vehicle_security ──
    console.log('\n── מיגון ──');
    await client.query('DELETE FROM vehicle_security');
    const secRows = parseCSV(fs.readFileSync(secPath, 'utf8'));

    // Clear and re-insert security companies
    await client.query('DELETE FROM security_companies');
    await client.query("SELECT setval('security_companies_id_seq', 1, false)");
    const companies = [...new Set(secRows.map(r => r['חברת מיגון']).filter(Boolean))];
    const compMap = {};
    for (const name of companies) {
      const res = await client.query(
        `INSERT INTO security_companies (name) VALUES ($1) RETURNING id`, [name]
      );
      compMap[name] = res.rows[0].id;
    }

    for (const r of secRows) {
      const vnum = r['רכב'];
      const vid = vMap[vnum];
      if (!vid) { console.log(`  Skip: ${vnum} not found`); continue; }
      const compId = compMap[r['חברת מיגון']] || null;
      await client.query(
        `INSERT INTO vehicle_security (vehicle_id, company_id, security_type, installation_date, notes)
         VALUES ($1,$2,$3,$4,$5)`,
        [vid, compId, r['סוג מיגון']||'איתור', parseDate(r['תאריך התקנה']), r['מזהה מיגון']||null]
      );
      console.log(`  ${r['מזהה מיגון']} → ${vnum} | ${r['חברת מיגון']}`);
    }

    // ── 2. Garages ──────────────────────────
    console.log('\n── מוסכים ──');
    await client.query('DELETE FROM garages');
    await client.query("SELECT setval('garages_id_seq', 1, false)");
    const garRows = parseCSV(fs.readFileSync(garPath, 'utf8'));
    const garMap = {};
    for (const r of garRows) {
      const name = r['שם מוסך'];
      if (!name) continue;
      const res = await client.query(
        `INSERT INTO garages (name, contact_name, phone, address, specialty, payment_terms, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [name, r['איש קשר']||null, r['טלפון']||null, r['כתובת']||null, r['התמחות']||null, r['תנאי תשלום']||null, r['הערות']||null]
      );
      garMap[name] = res.rows[0].id;
      console.log(`  ${name} (${r['התמחות']||'—'})`);
    }

    // ── 3. Fuel cards ────────────────────────
    console.log('\n── כרטיסי דלק ──');
    await client.query('DELETE FROM fuel_cards');
    const fuelRows = parseCSV(fs.readFileSync(fuelPath, 'utf8'));
    let cardCount = 0;
    for (const r of fuelRows) {
      const cardNum = r['מספר כרטיס'];
      if (!cardNum) continue;
      const vnum = r['רכב'];
      const vid = vnum ? vMap[vnum] : null;
      const status = r['סטטוס'] === 'חסום' ? 'חסום' : 'פעיל';
      const lastFuel = parseDate(r['תאריך תדלוק אחרון']);
      const monthlyLimit = parseFloat(r['הגבלת דלק (ליטר) חודשי']) || null;
      const dailyLimit = parseFloat(r['הגבלת דלק (ליטר) יומי']) || null;
      const fuelType = r['סוג דלק מותר'] === 'שניהם' ? 'שניהם' : r['סוג דלק מותר'] || null;
      const supplier = r['ספק דלק'] || 'דלקן';
      const reason = r['סיבת חסימה'];
      const notes = [r['הערות'], reason && reason !== 'פתוח' ? `חסימה: ${reason}` : ''].filter(Boolean).join(' | ') || null;

      const assetType = r['סוג נכס (from רכב)'] || null;
      await client.query(
        `INSERT INTO fuel_cards (card_number, supplier, vehicle_id, asset_type, fuel_type, status, daily_limit, monthly_limit, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cardNum, supplier, vid, assetType, fuelType, status, dailyLimit, monthlyLimit, notes]
      );
      cardCount++;
      console.log(`  ${cardNum} | ${vnum||'—'} | ${status}${reason && reason!=='פתוח' ? ` (${reason})`:''}`);
    }

    await client.query('COMMIT');
    console.log(`\n✅ Done!`);
    const stats = await client.query(`
      SELECT 'security_companies' t, count(*) FROM security_companies
      UNION ALL SELECT 'vehicle_security', count(*) FROM vehicle_security
      UNION ALL SELECT 'garages', count(*) FROM garages
      UNION ALL SELECT 'fuel_cards', count(*) FROM fuel_cards
    `);
    stats.rows.forEach(r => console.log(`  ${r.t}: ${r.count}`));

  } catch(e) {
    await client.query('ROLLBACK');
    console.error('Failed:', e.message, '\n', e.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
