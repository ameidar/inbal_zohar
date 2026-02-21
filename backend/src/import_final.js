/**
 * Import: maintenance, security_companies (update), inspections
 * node src/import_final.js
 */
const fs = require('fs');
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST||'localhost', port: process.env.DB_PORT||5432,
  database: process.env.DB_NAME||'fleet_db', user: process.env.DB_USER||'fleet_user',
  password: process.env.DB_PASSWORD||'fleet123',
});

function parseDate(s) {
  if (!s||!s.trim()) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
}
function parseMoney(s) {
  if (!s||!s.trim()) return null;
  const n = parseFloat(s.replace(/[₪,\s]/g,'').trim());
  return isNaN(n)?null:n;
}
function parseLine(line) {
  const r=[];let c='';let q=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++;}else q=!q;}
    else if(ch===','&&!q){r.push(c);c='';}
    else c+=ch;
  }
  r.push(c);return r;
}
function parseCSV(text) {
  const lines=text.split('\n').filter(l=>l.trim());
  const headers=parseLine(lines[0]);
  return lines.slice(1).map(line=>{
    const vals=parseLine(line);
    const row={};
    headers.forEach((h,i)=>{row[h.trim()]=(vals[i]||'').trim();});
    return row;
  });
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Vehicle + Garage maps
    const vRes = await client.query('SELECT id, vehicle_number FROM vehicles');
    const vMap = {};
    vRes.rows.forEach(r => { vMap[r.vehicle_number] = r.id; });

    const gRes = await client.query('SELECT id, name FROM garages');
    const garMap = {};
    gRes.rows.forEach(r => { garMap[r.name.trim()] = r.id; });

    // ── 1. Security companies: add קוברה + סקיילוק if missing ──
    console.log('\n── חברות מיגון ──');
    const secComps = parseCSV(fs.readFileSync(process.argv[2], 'utf8'));
    for (const r of secComps) {
      const name = r['שם חברה']?.trim();
      if (!name) continue;
      const exists = await client.query('SELECT id FROM security_companies WHERE name=$1', [name]);
      if (exists.rows.length === 0) {
        await client.query(
          `INSERT INTO security_companies (name, contact_name, phone, notes) VALUES ($1,$2,$3,$4)`,
          [name, r['איש קשר']||null, r['טלפון']||null, r['הערות']||null]
        );
        console.log(`  Added: ${name}`);
      } else {
        await client.query(
          `UPDATE security_companies SET contact_name=$2, phone=$3, notes=$4 WHERE name=$1`,
          [name, r['איש קשר']||null, r['טלפון']||null, r['הערות']||null]
        );
        console.log(`  Updated: ${name}`);
      }
    }

    // ── 2. Inspections: replace with real data ──
    console.log('\n── בדיקות רכב ──');
    await client.query('DELETE FROM inspections');
    const inspRows = parseCSV(fs.readFileSync(process.argv[3], 'utf8'));
    let inspCount = 0;
    for (const r of inspRows) {
      const vnum = r['רכב']?.trim();
      if (!vnum) continue;
      const vid = vMap[vnum];
      if (!vid) { console.log(`  Skip: vehicle ${vnum} not found`); continue; }

      const typeRaw = r['סוג בדיקה']?.trim() || 'טסט';
      const inspType = typeRaw === 'תסקיר' ? 'ריקורד' : 'טסט';
      const inspDate = parseDate(r['תאריך בדיקה']);
      const nextDate = parseDate(r['תאריך בדיקה הבאה']);
      const inspector = r['גורם בודק']?.trim() || null;
      const notes = [r['הערות']?.trim(), r['תת סוג בדיקה']?.trim()].filter(Boolean).join(' | ') || null;
      const inspNum = r['מספר בדיקה']?.trim() || null;

      await client.query(
        `INSERT INTO inspections (vehicle_id, inspection_type, inspection_date, next_inspection_date, inspector, passed, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [vid, inspType, inspDate, nextDate, inspector, true, [notes, inspNum?`מספר: ${inspNum}`:''].filter(Boolean).join(' | ')||null]
      );
      inspCount++;
      console.log(`  ${vnum} | ${inspType} | ${inspDate} → ${nextDate||'—'}${inspector?' | '+inspector:''}`);
    }

    // ── 3. Maintenance ──
    console.log('\n── טיפולים ──');
    await client.query('DELETE FROM maintenance');
    const maintRows = parseCSV(fs.readFileSync(process.argv[4], 'utf8'));
    let maintCount = 0;
    for (const r of maintRows) {
      const vnum = r['רכב']?.trim();
      if (!vnum) continue;
      const vid = vMap[vnum];
      if (!vid) { console.log(`  Skip: ${vnum} not found`); continue; }

      // Find garage
      const garageName = r['מוסך']?.trim();
      let garId = null;
      if (garageName) {
        garId = garMap[garageName] || null;
        if (!garId) {
          // Find partial match
          const key = Object.keys(garMap).find(k => k.includes(garageName) || garageName.includes(k));
          if (key) garId = garMap[key];
        }
      }

      const maintDate = parseDate(r['תאריך טיפול']);
      const nextDate = parseDate(r['תאריך טיפול הבא']);
      const typeRaw = r['סוג טיפול']?.trim() || 'אחר';
      const maintType = ['טיפול תקופתי','תקלה','חירום','אחר'].includes(typeRaw) ? typeRaw : 'אחר';
      const odometer = parseInt(r['ק"מ / שעות']||r['קמ / שעות']||'') || null;
      const cost = parseMoney(r['מחיר טיפול']);
      const desc = r['תיאור טיפול']?.replace(/\n/g,' ').trim() || null;
      const statusRaw = r['סטטוס טיפול']?.trim();
      const status = statusRaw === 'בוצע' ? 'בוצע' : statusRaw === 'פתוח' ? 'פתוח' : 'פתוח';

      await client.query(
        `INSERT INTO maintenance (vehicle_id, garage_id, maintenance_type, maintenance_date, odometer, description, cost, status, next_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [vid, garId, maintType, maintDate, odometer, desc, cost, status, nextDate]
      );
      maintCount++;
      console.log(`  ${vnum} | ${maintType} | ${maintDate||'—'} | ₪${cost||'?'} | ${status}`);
    }

    await client.query('COMMIT');
    console.log(`\n✅ Done! ${inspCount} inspections, ${maintCount} maintenance`);

    const stats = await client.query(`
      SELECT 'security_companies' t, count(*) FROM security_companies
      UNION ALL SELECT 'inspections', count(*) FROM inspections
      UNION ALL SELECT 'maintenance', count(*) FROM maintenance
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
