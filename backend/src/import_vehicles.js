/**
 * Import real vehicle data from CSV
 * Run: node src/import_vehicles.js /path/to/file.csv
 */
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fleet_db',
  user: process.env.DB_USER || 'fleet_user',
  password: process.env.DB_PASSWORD || 'fleet123',
});

// Parse Israeli date dd/mm/yyyy → yyyy-mm-dd or null
function parseDate(s) {
  if (!s || s.trim() === '') return null;
  // Could be "dd/mm/yyyy" or "dd/m/yyyy"
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

// Parse inspection string like "טסט | 60736 | 27/01/2026" or "טסט | 27/01/2026"
function parseInspection(s) {
  if (!s || !s.trim()) return null;
  const parts = s.split('|').map(p => p.trim());
  const type = parts[0] || 'טסט';
  // last part that looks like a date
  const datePart = parts.find(p => /\d{2}\/\d{2}\/\d{4}/.test(p));
  const kmPart = parts.find(p => /^\d{4,}$/.test(p));
  return {
    inspection_type: type === 'תסקיר' ? 'ריקורד' : 'טסט',
    inspection_date: parseDate(datePart),
    odometer: kmPart ? parseInt(kmPart) : null,
  };
}

// Simple CSV parser (handles quoted fields with commas)
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] || '').trim(); });
    return row;
  });
}

function parseLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (c === ',' && !inQuote) {
      result.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

async function run() {
  const csvPath = process.argv[2];
  if (!csvPath) { console.error('Usage: node import_vehicles.js <csv_file>'); process.exit(1); }
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(text);
  console.log(`Parsed ${rows.length} rows`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Clear existing demo data (keep users)
    console.log('Clearing demo data...');
    await client.query('TRUNCATE TABLE vehicle_security, diesel_refunds, fuel_invoice_lines, fuel_invoices, fuel_cards, insurance_payments, insurance_policies, tool_movements, tools, inspections, maintenance, vehicle_employees, vehicles, employees, garages RESTART IDENTITY CASCADE');

    // 2. Collect unique employee names
    const empNames = new Set();
    rows.forEach(r => {
      const e = r['אחראי רכב'];
      if (e && e.trim()) empNames.add(e.trim());
    });
    const empMap = {};
    for (const name of empNames) {
      const res = await client.query(
        `INSERT INTO employees (name, role, active) VALUES ($1, 'נהג', true) RETURNING id`,
        [name]
      );
      empMap[name] = res.rows[0].id;
      console.log(`  Employee: ${name}`);
    }

    // 3. Deduplicate vehicles by vehicle_number (first occurrence wins)
    const seen = new Set();
    const unique = [];
    for (const r of rows) {
      const vn = r['מספר רכב'];
      if (!vn || seen.has(vn)) continue;
      seen.add(vn);
      unique.push(r);
    }
    console.log(`Unique vehicles: ${unique.length}`);

    // 4. Insert vehicles + insurance + inspections
    const policyMap = {}; // vehicle_number → [{type, expiry}]

    for (const r of unique) {
      const vnum = r['מספר רכב'];
      const status_raw = r['סטטוס'];
      const status = status_raw === 'נמכר' ? 'מושבת' : 'פעיל';
      const empName = r['אחראי רכב'];
      const empId = empName ? empMap[empName] : null;
      const purchaseDate = parseDate(r['תאריך רכישה']);
      const fuel = r['סוג דלק'] || null;
      const vehicleType = r['סוג נכס'] || null;

      const res = await client.query(
        `INSERT INTO vehicles (vehicle_number, nickname, asset_type, fuel_type, status, manufacturer, model, year, chassis_number, purchase_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [
          vnum,
          r['שם כלי / כינוי'] || null,
          vehicleType,
          fuel || null,
          status,
          r['יצרן'] || null,
          r['דגם'] || null,
          r['שנת ייצור'] ? parseInt(r['שנת ייצור']) : null,
          r['מספר שילדה'] || null,
          purchaseDate,
          [r['הערות כלליות'], r['הערות על הרכב']].filter(Boolean).join(' | ') || null,
        ]
      );
      const vid = res.rows[0].id;
      console.log(`  Vehicle: ${vnum} (${r['שם כלי / כינוי'] || '—'})`);

      // Assign employee to vehicle
      if (empId) {
        await client.query(
          `INSERT INTO vehicle_employees (vehicle_id, employee_id, is_responsible) VALUES ($1,$2,true)`,
          [vid, empId]
        ).catch(() => {});
      }

      // Security - store MIG number in notes
      const secNum = r['מיגון לרכב'];
      if (secNum && secNum.trim()) {
        await client.query(
          `INSERT INTO vehicle_security (vehicle_id, security_type, notes) VALUES ($1,$2,$3)`,
          [vid, 'מיגון', `מספר מיגון: ${secNum.trim()}`]
        ).catch(() => {});
      }

      // Inspection
      const inspStr = r['בדיקות רכב'];
      const nextInsp = parseDate(r['תאריך בדיקה הבאה (from תסקירים)']);
      if (inspStr || nextInsp) {
        const insp = parseInspection(inspStr);
        await client.query(
          `INSERT INTO inspections (vehicle_id, inspection_type, inspection_date, next_inspection_date, passed)
           VALUES ($1,$2,$3,$4,$5)`,
          [vid, insp?.inspection_type || 'טסט', insp?.inspection_date || null, nextInsp, true]
        ).catch(() => {});
      }

      // Insurance policies - parse from "פוליסות" and "פקיעת פוליסה" columns
      const policiesStr = r['פוליסות'];  // e.g. "244046 | שופל  | חובה,244046 | שופל  | מקיף"
      const expiriesStr = r['פקיעת פוליסה (from פוליסות)'];  // e.g. "31/1/2027, 31/12/2026"
      if (policiesStr && expiriesStr) {
        const policyItems = policiesStr.split(',').map(p => p.trim()).filter(Boolean);
        const expiryItems = expiriesStr.split(',').map(e => parseDate(e.trim())).filter(Boolean);
        for (let i = 0; i < policyItems.length; i++) {
          const parts = policyItems[i].split('|').map(p => p.trim());
          const coverageType = parts[parts.length - 1] || 'חובה';
          const expiry = expiryItems[i] || null;
          if (!expiry) continue;
          await client.query(
            `INSERT INTO insurance_policies (vehicle_id, policy_number, coverage_type, insurer, start_date, expiry_date, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [vid, `POL-${vnum}-${i+1}`, coverageType, 'לא ידוע', null, expiry, status === 'פעיל' ? 'פעילה' : 'בוטלה']
          ).catch(() => {});
        }
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Import complete!');

    // Summary
    const counts = await client.query(`
      SELECT 'vehicles' as t, count(*) FROM vehicles
      UNION ALL SELECT 'employees', count(*) FROM employees
      UNION ALL SELECT 'insurance_policies', count(*) FROM insurance_policies
      UNION ALL SELECT 'inspections', count(*) FROM inspections
      UNION ALL SELECT 'vehicle_security', count(*) FROM vehicle_security
    `);
    counts.rows.forEach(r => console.log(`  ${r.t}: ${r.count}`));

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Import failed:', e.message);
    console.error(e.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
