/**
 * Import employees + insurance policies from CSV
 * Run: node src/import_employees_policies.js data/employees.csv data/policies.csv
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

function parseDate(s) {
  if (!s || !s.trim()) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
}

function parseMoney(s) {
  if (!s || !s.trim()) return null;
  const n = parseFloat(s.replace(/[₪,]/g, '').trim());
  return isNaN(n) ? null : n;
}

function parseNum(s) {
  if (!s || !s.trim()) return null;
  const n = parseInt(s.trim());
  return isNaN(n) ? null : n;
}

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
  const empPath = process.argv[2];
  const polPath = process.argv[3];
  if (!empPath || !polPath) {
    console.error('Usage: node import_employees_policies.js <employees.csv> <policies.csv>');
    process.exit(1);
  }

  const empRows = parseCSV(fs.readFileSync(empPath, 'utf8'));
  const polRows = parseCSV(fs.readFileSync(polPath, 'utf8'));
  console.log(`Employees: ${empRows.length} rows, Policies: ${polRows.length} rows`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Rebuild employees from scratch ──────────────────────────
    console.log('\n── Employees ──');
    await client.query('DELETE FROM vehicle_employees');
    await client.query('DELETE FROM employees');
    await client.query('SELECT setval(\'employees_id_seq\', 1, false)');

    // Build vehicle_number → id map
    const vRes = await client.query('SELECT id, vehicle_number FROM vehicles');
    const vMap = {};
    vRes.rows.forEach(r => { vMap[r.vehicle_number] = r.id; });

    const empMap = {}; // name → id
    const SALARY_MAP = { 'גלובלי':'גלובלי', 'שעתי':'שעתי', 'לפי ימי עבודה':'יומי', 'קבלן':'קבלן' };

    for (const r of empRows) {
      const name = r['שם עובד']?.trim();
      if (!name) continue;
      // Skip duplicates/empty rows
      const idNum = r['ת.ז']?.trim() || null;
      const role = r['תפקיד']?.trim() || null;
      const phone = r['טלפון']?.trim() || null;
      const email = r['מייל']?.trim() || null;
      const startDate = parseDate(r['תאריך התחלת עבודה']);
      const endDate = parseDate(r['תאריך סיום עבודה']);
      const activeRaw = r['פעיל / לא פעיל']?.trim();
      const active = activeRaw === 'checked' || (!endDate && !activeRaw);
      const notes = r['הערות']?.trim() || null;
      const salaryType = SALARY_MAP[r['שכר']?.trim()] || r['שכר']?.trim() || null;

      let res;
      try {
        res = await client.query(
          `INSERT INTO employees (name, id_number, role, phone, email, start_date, end_date, active, salary_type, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (id_number) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role, phone=EXCLUDED.phone, active=EXCLUDED.active, salary_type=EXCLUDED.salary_type
           RETURNING id`,
          [name, idNum, role, phone, email, startDate, endDate, active, salaryType, notes]
        );
      } catch(e) {
        // id_number conflict or null - insert without it
        res = await client.query(
          `INSERT INTO employees (name, role, phone, email, start_date, end_date, active, salary_type, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [name, role, phone, email, startDate, endDate, active, salaryType, notes]
        );
      }
      const empId = res.rows[0].id;
      empMap[name] = empId;
      console.log(`  ${name} (${role || '—'}) → id ${empId}`);

      // Link to vehicles
      const vehiclesStr = r['רכבים']?.trim();
      if (vehiclesStr) {
        const vnums = vehiclesStr.split(',').map(v => v.trim()).filter(Boolean);
        for (const vn of vnums) {
          const vid = vMap[vn];
          if (vid) {
            await client.query(
              `INSERT INTO vehicle_employees (vehicle_id, employee_id, is_responsible) VALUES ($1,$2,true) ON CONFLICT DO NOTHING`,
              [vid, empId]
            );
          }
        }
      }
    }

    // ── 2. Replace insurance policies ─────────────────────────────
    console.log('\n── Insurance Policies ──');
    await client.query('DELETE FROM insurance_payments');
    await client.query('DELETE FROM insurance_policies');
    await client.query('SELECT setval(\'insurance_policies_id_seq\', 1, false)');

    let polCount = 0;
    for (const r of polRows) {
      const vnum = r['רכב']?.trim();
      if (!vnum) continue;

      const vid = vMap[vnum];
      // Vehicle might not exist (e.g., sold vehicles removed) - skip
      if (!vid) { console.log(`  Skip: vehicle ${vnum} not found`); continue; }

      const policyNum = r['מספר פוליסה']?.trim() || null;
      const coverage = r['סוג כיסוי']?.trim() || null;
      const insurer = r['חברת ביטוח']?.trim() || null;
      const expiry = parseDate(r['פקיעת פוליסה']);
      const premium = parseMoney(r['מחיר פוליסה הכולל']);
      const monthlyAmt = parseMoney(r['סכום חיוב חודשי']);
      const numPayRaw = r['מספר תשלומים']?.trim();
      const numPay = (numPayRaw === 'Infinity' || !numPayRaw) ? null : parseNum(numPayRaw);
      const chargeDay = parseNum(r['יום החיוב בחודש (from אופן תשלום)']);
      const firstCharge = parseDate(r['תאריך חיוב ראשון']);
      const statusRaw = r['סטטוס פוליסה']?.trim();
      const status = statusRaw === 'הסתיימה' ? 'בוטלה' : (statusRaw === 'פעילה' ? 'פעילה' : 'פעילה');
      const notes = r['הערות']?.trim() || null;
      const payMethod = r['אופן תשלום']?.trim() || null;

      const pRes = await client.query(
        `INSERT INTO insurance_policies
           (vehicle_id, policy_number, coverage_type, insurer, expiry_date, total_premium, num_payments, first_charge_day, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [vid, policyNum, coverage, insurer, expiry, premium, numPay, chargeDay, status, [notes, payMethod].filter(Boolean).join(' | ') || null]
      );
      const polId = pRes.rows[0].id;
      polCount++;

      // Create payment records if we have enough info
      if (firstCharge && monthlyAmt && numPay && numPay > 0 && numPay <= 36) {
        for (let i = 0; i < numPay; i++) {
          const d = new Date(firstCharge);
          d.setMonth(d.getMonth() + i);
          const chargeDate = d.toISOString().split('T')[0];
          const isPast = d < new Date();
          await client.query(
            `INSERT INTO insurance_payments (policy_id, payment_number, charge_date, expected_amount, status)
             VALUES ($1,$2,$3,$4,$5)`,
            [polId, i+1, chargeDate, monthlyAmt, isPast ? 'שולם' : 'פתוח']
          );
        }
      }

      const vname = r['שם כלי / כינוי (from רכב)']?.trim() || vnum;
      console.log(`  [${vname}] ${coverage} | ${insurer} | עד ${expiry || '—'} | ₪${premium||'?'}`);
    }

    await client.query('COMMIT');
    console.log(`\n✅ Done! ${Object.keys(empMap).length} employees, ${polCount} policies`);

    const stats = await client.query(`
      SELECT 'employees' t, count(*) FROM employees
      UNION ALL SELECT 'vehicle_employees', count(*) FROM vehicle_employees
      UNION ALL SELECT 'insurance_policies', count(*) FROM insurance_policies
      UNION ALL SELECT 'insurance_payments', count(*) FROM insurance_payments
    `);
    stats.rows.forEach(r => console.log(`  ${r.t}: ${r.count}`));

  } catch(e) {
    await client.query('ROLLBACK');
    console.error('Import failed:', e.message, e.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
