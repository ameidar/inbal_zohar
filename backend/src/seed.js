const bcrypt = require('bcryptjs');
const pool = require('./db');

async function seed() {
  console.log('Seeding database...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users
    const adminHash = await bcrypt.hash('admin123', 10);
    const reporterHash = await bcrypt.hash('report123', 10);
    await client.query(`INSERT INTO users (username, password_hash, role, full_name) VALUES
      ('admin', $1, 'admin', 'מנהל מערכת'),
      ('reporter', $2, 'reporter', 'מדווח')
      ON CONFLICT (username) DO NOTHING`, [adminHash, reporterHash]);

    // Payment methods
    const pm = await client.query(`INSERT INTO payment_methods (name, payment_type, last_4_digits, charge_day, company) VALUES
      ('ויזה 4444', 'אשראי', '4444', 1, 'ויזה כ.א.ל'),
      ('הו"ק בנק הפועלים', 'הו"ק', NULL, 5, 'בנק הפועלים')
      ON CONFLICT DO NOTHING RETURNING id`);
    const pm1 = (await client.query(`SELECT id FROM payment_methods WHERE name='ויזה 4444'`)).rows[0]?.id;
    const pm2 = (await client.query(`SELECT id FROM payment_methods WHERE name='הו"ק בנק הפועלים'`)).rows[0]?.id;

    // Employees
    await client.query(`INSERT INTO employees (name, id_number, role, phone, email, start_date, active, salary_type, salary_amount) VALUES
      ('דוד כהן', '123456789', 'מנהל צוות תקלות', '050-1111111', 'david@co.il', '2020-01-15', true, 'גלובלי', 12000),
      ('שרה לוי', '234567890', 'מנהלת משרד', '052-2222222', 'sara@co.il', '2019-06-01', true, 'גלובלי', 11000),
      ('יוסי אברהם', '345678901', 'מפעיל', '054-3333333', NULL, '2021-03-10', true, 'לפי ימי עבודה', 400),
      ('מיכאל גרין', '456789012', 'חשמלאי', '053-4444444', NULL, '2018-09-01', true, 'גלובלי', 14000),
      ('אחמד עלי', '567890123', 'מפעיל חיצוני', '055-5555555', NULL, '2022-01-01', true, 'קבלן', 0),
      ('נתאלי בן-דוד', '678901234', 'עובד כללי', '050-6666666', NULL, '2023-05-15', true, 'לפי ימי עבודה', 350)
      ON CONFLICT (id_number) DO NOTHING`);

    // Vehicles
    await client.query(`INSERT INTO vehicles (vehicle_number, nickname, asset_type, fuel_type, status, manufacturer, model, year, chassis_number, purchase_date, eligible_diesel_refund) VALUES
      ('12-345-67', 'גוזל', 'משאית', 'סולר', 'פעיל', 'מרצדס', 'אקטרוס', 2019, 'WDB9634031L123456', '2019-03-15', true),
      ('23-456-78', 'נמר', 'מכונית', 'בנזין', 'פעיל', 'טויוטה', 'הילוקס', 2021, 'MROJA3CD301234567', '2021-07-20', false),
      ('34-567-89', 'פיל', 'צמ"ה', 'סולר', 'פעיל', 'CAT', '320', 2018, 'CAT0000320V12345', '2018-01-10', true),
      ('45-678-90', 'כרישה', 'משאית', 'סולר', 'בהקפאה', 'איווקו', 'אולי', 2017, 'IVC0000017L98765', '2017-05-05', true),
      ('56-789-01', 'שועל', 'מכונית', 'בנזין', 'פעיל', 'מיצובישי', 'L200', 2022, 'MBJ000L2002345678', '2022-11-30', false),
      ('67-890-12', 'בופור', 'נגרר', 'אחר', 'פעיל', 'גולדהופר', 'STN-L', 2020, 'GLD000020L456789', '2020-06-01', false),
      ('78-901-23', 'ברדלס', 'כלי תפעולי', 'סולר', 'פעיל', 'בובקט', 'S450', 2021, 'BCT000S450789012', '2021-04-15', true),
      ('89-012-34', 'אורקה', 'מכונית', 'בנזין', 'מושבת', 'פורד', 'טרנזיט', 2016, 'FORD000TR2016012', '2016-08-08', false)
      ON CONFLICT (vehicle_number) DO NOTHING`);

    // Get vehicle ids
    const vRows = (await client.query(`SELECT id, vehicle_number FROM vehicles ORDER BY id`)).rows;
    const v = {};
    vRows.forEach(r => v[r.vehicle_number] = r.id);

    // Employee ids
    const eRows = (await client.query(`SELECT id, name FROM employees ORDER BY id`)).rows;
    const e = {};
    eRows.forEach(r => e[r.name] = r.id);

    // Vehicle-Employee assignments
    const davidId = e['דוד כהן'];
    const yossiId = e['יוסי אברהם'];
    const mikhaelId = e['מיכאל גרין'];
    const ahmadId = e['אחמד עלי'];
    if (v['12-345-67'] && davidId) await client.query(`INSERT INTO vehicle_employees VALUES ($1,$2,true) ON CONFLICT DO NOTHING`, [v['12-345-67'], davidId]);
    if (v['23-456-78'] && yossiId) await client.query(`INSERT INTO vehicle_employees VALUES ($1,$2,true) ON CONFLICT DO NOTHING`, [v['23-456-78'], yossiId]);
    if (v['34-567-89'] && mikhaelId) await client.query(`INSERT INTO vehicle_employees VALUES ($1,$2,true) ON CONFLICT DO NOTHING`, [v['34-567-89'], mikhaelId]);
    if (v['56-789-01'] && ahmadId) await client.query(`INSERT INTO vehicle_employees VALUES ($1,$2,true) ON CONFLICT DO NOTHING`, [v['56-789-01'], ahmadId]);

    // Garages
    await client.query(`INSERT INTO garages (name, contact_name, phone, address, specialty, payment_terms) VALUES
      ('מוסך אבי', 'אבי כהן', '03-1234567', 'תל אביב, רח רשי 5', 'תיקוני מנוע', 'שוטף 60'),
      ('צמ"ה שירותים בע"מ', 'רמי לוי', '08-9876543', 'באר שבע, אזה"ת', 'ציוד כבד', 'שוטף 60'),
      ('מוסך הצפון', 'חנן ברק', '04-7654321', 'חיפה, נמל', 'חשמל רכב', 'מזומן'),
      ('טירה שירות', 'כמאל עמר', '09-1112233', 'טירה, אזה"ת', 'כללי', 'מזומן')
      ON CONFLICT DO NOTHING`);

    const gRows = (await client.query(`SELECT id, name FROM garages ORDER BY id`)).rows;
    const g = {};
    gRows.forEach(r => g[r.name] = r.id);

    // Maintenance
    const today = new Date();
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x.toISOString().split('T')[0]; };
    const subDays = (d, n) => addDays(d, -n);
    const todayStr = today.toISOString().split('T')[0];

    // Insert maintenance records one by one to avoid param mismatch
    const maintenanceData = [
      [v['12-345-67'], g['מוסך אבי'], 'טיפול תקופתי', subDays(todayStr, 30), 120000, 'טיפול 120k קמ, החלפת שמן ופילטרים', 1800, 'בוצע', addDays(todayStr, 150)],
      [v['23-456-78'], g['מוסך הצפון'], 'תקלה', subDays(todayStr, 60), 85000, 'תיקון פיצוץ צמיג + גלגל', 650, 'בוצע', null],
      [v['56-789-01'], g['טירה שירות'], 'טיפול תקופתי', addDays(todayStr, 7), 45000, 'טיפול 45k קמ', 1200, 'פתוח', addDays(todayStr, 180)],
      [v['34-567-89'], g['מוסך אבי'], 'חירום', subDays(todayStr, 90), 200000, 'תיקון מנוע אחרי התחממות', 8500, 'בוצע', null],
      [v['78-901-23'], g['מוסך אבי'], 'טיפול תקופתי', addDays(todayStr, 14), 30000, 'טיפול 30k קמ שמן+פילטרים', 900, 'פתוח', addDays(todayStr, 180)],
      [v['67-890-12'], g['מוסך הצפון'], 'תקלה', subDays(todayStr, 15), 60000, 'בעיית חשמל, החלפת דינמו', 2400, 'בוצע', null],
    ];
    for (const m of maintenanceData) {
      await client.query(`INSERT INTO maintenance (vehicle_id, garage_id, maintenance_type, maintenance_date, odometer, description, cost, status, next_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, m);
    }

    // Inspections
    await client.query(`INSERT INTO inspections (vehicle_id, inspection_type, inspection_date, next_inspection_date, inspector, cost, passed) VALUES
      ($1, 'טסט', $2, $3, 'מבחן הרכב ת"א', 180, true),
      ($4, 'טסט', $5, $6, 'מבחן הרכב ב"ש', 180, true),
      ($7, 'ריקורד', $8, $9, 'משרד התחבורה', 350, true),
      ($10, 'טסט', $11, $12, 'מבחן הרכב חיפה', 180, false),
      ($13, 'ריקורד', $14, $15, 'משרד התחבורה', 350, true)`,
      [
        v['12-345-67'], subDays(todayStr, 200), addDays(todayStr, 165),
        v['23-456-78'], subDays(todayStr, 100), addDays(todayStr, 265),
        v['34-567-89'], subDays(todayStr, 50), addDays(todayStr, 315),
        v['45-678-90'], subDays(todayStr, 5), null,
        v['56-789-01'], subDays(todayStr, 180), addDays(todayStr, 185)
      ]
    );

    // Fuel cards
    await client.query(`INSERT INTO fuel_cards (card_number, supplier, vehicle_id, status, fuel_type, daily_limit, monthly_limit) VALUES
      ('1001', 'סונול', $1, 'פעיל', 'סולר', 500, 8000),
      ('1002', 'פז', $2, 'פעיל', 'בנזין', 300, 5000),
      ('1003', 'דלק', $3, 'פעיל', 'סולר', 800, 15000),
      ('1004', 'סונול', $4, 'חסום', 'סולר', 400, 7000),
      ('1005', 'פז', $5, 'פעיל', 'בנזין', 250, 4000),
      ('1006', 'סונול', $6, 'פעיל', 'סולר', 600, 10000)
      ON CONFLICT (card_number) DO NOTHING`,
      [v['12-345-67'], v['23-456-78'], v['34-567-89'], v['45-678-90'], v['56-789-01'], v['78-901-23']]
    );

    // Fuel invoices + lines
    const fi1 = await client.query(`INSERT INTO fuel_invoices (supplier, period, invoice_date, total_liters_diesel, total_amount_diesel, total_liters_petrol, total_amount_petrol, total_amount) VALUES
      ('סונול', '2025-11', '2025-12-01', 4500.5, 27003, 1200.0, 8400, 35403)
      RETURNING id`);
    const fi1id = fi1.rows[0].id;
    await client.query(`INSERT INTO fuel_invoice_lines (fuel_invoice_id, vehicle_id, vehicle_number_raw, period, fuel_type, liters, amount) VALUES
      ($1, $2, '12-345-67', '2025-11', 'סולר', 1800.5, 10803),
      ($1, $3, '34-567-89', '2025-11', 'סולר', 2100.0, 12600),
      ($1, $4, '78-901-23', '2025-11', 'סולר', 600.0, 3600),
      ($1, $5, '23-456-78', '2025-11', 'בנזין', 700.0, 4900),
      ($1, $6, '56-789-01', '2025-11', 'בנזין', 500.0, 3500)`,
      [fi1id, v['12-345-67'], v['34-567-89'], v['78-901-23'], v['23-456-78'], v['56-789-01']]
    );

    const fi2 = await client.query(`INSERT INTO fuel_invoices (supplier, period, invoice_date, total_liters_diesel, total_amount_diesel, total_liters_petrol, total_amount_petrol, total_amount) VALUES
      ('פז', '2025-12', '2026-01-02', 3800.0, 23370, 900.0, 6570, 29940)
      RETURNING id`);
    const fi2id = fi2.rows[0].id;
    await client.query(`INSERT INTO fuel_invoice_lines (fuel_invoice_id, vehicle_id, vehicle_number_raw, period, fuel_type, liters, amount) VALUES
      ($1, $2, '12-345-67', '2025-12', 'סולר', 1600.0, 9840),
      ($1, $3, '34-567-89', '2025-12', 'סולר', 1900.0, 11685),
      ($1, $4, '78-901-23', '2025-12', 'סולר', 300.0, 1845),
      ($1, $5, '23-456-78', '2025-12', 'בנזין', 900.0, 6570)`,
      [fi2id, v['12-345-67'], v['34-567-89'], v['78-901-23'], v['23-456-78']]
    );

    // Security companies
    await client.query(`INSERT INTO security_companies (name, contact_name, phone) VALUES
      ('מובינג', 'גל שטרן', '03-5555555'),
      ('אי.אם.אס', 'אורן כץ', '077-6666666'),
      ('פואנטה', 'ניר דן', '09-7777777')
      ON CONFLICT DO NOTHING`);

    const scRows = (await client.query(`SELECT id, name FROM security_companies ORDER BY id`)).rows;
    const sc = {};
    scRows.forEach(r => sc[r.name] = r.id);

    // Vehicle security
    await client.query(`INSERT INTO vehicle_security (vehicle_id, company_id, security_type, installation_date, renewal_date, subscription_fee) VALUES
      ($1, $2, 'איתורן', '2022-01-01', $3, 89),
      ($4, $5, 'איתורן', '2021-06-01', $6, 89),
      ($7, $8, 'מצלמות', '2020-03-15', $9, 150)`,
      [
        v['12-345-67'], sc['מובינג'], addDays(todayStr, 45),
        v['34-567-89'], sc['אי.אם.אס'], addDays(todayStr, 120),
        v['23-456-78'], sc['פואנטה'], addDays(todayStr, 200)
      ]
    );

    // Insurance policies
    const pol1 = await client.query(`INSERT INTO insurance_policies (vehicle_id, policy_number, coverage_type, insurer, start_date, expiry_date, total_premium, num_payments, first_charge_day, status) VALUES
      ($1, 'POL-001', 'מקיף', 'הפניקס', '2025-01-01', '2026-01-01', 7200, 12, 1, 'פעילה') RETURNING id`, [v['12-345-67']]);
    const pol2 = await client.query(`INSERT INTO insurance_policies (vehicle_id, policy_number, coverage_type, insurer, start_date, expiry_date, total_premium, num_payments, first_charge_day, status) VALUES
      ($1, 'POL-002', 'חובה', 'מגדל', '2025-02-01', '2026-02-01', 3600, 12, 5, 'פעילה') RETURNING id`, [v['23-456-78']]);
    const pol3 = await client.query(`INSERT INTO insurance_policies (vehicle_id, policy_number, coverage_type, insurer, start_date, expiry_date, total_premium, num_payments, first_charge_day, status) VALUES
      ($1, 'POL-003', 'מקיף+ג"יפ', 'הראל', '2024-06-01', $2, 9600, 12, 1, 'פעילה') RETURNING id`, [v['34-567-89'], addDays(todayStr, 20)]);
    const pol4 = await client.query(`INSERT INTO insurance_policies (vehicle_id, policy_number, coverage_type, insurer, start_date, expiry_date, total_premium, num_payments, first_charge_day, status) VALUES
      ($1, 'POL-004', 'חובה', 'כלל', '2025-03-01', '2026-03-01', 2400, 12, 1, 'פעילה') RETURNING id`, [v['56-789-01']]);
    const pol5 = await client.query(`INSERT INTO insurance_policies (vehicle_id, policy_number, coverage_type, insurer, start_date, expiry_date, total_premium, num_payments, first_charge_day, status) VALUES
      ($1, 'POL-005', 'מקיף', 'איילון', '2025-01-01', '2026-01-01', 5400, 12, 15, 'פעילה') RETURNING id`, [v['78-901-23']]);

    // Create insurance payments for each policy
    const createPayments = async (policyId, numPayments, totalPremium, startDate, firstChargeDay) => {
      const perPayment = (totalPremium / numPayments).toFixed(2);
      for (let i = 0; i < numPayments; i++) {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + i);
        d.setDate(firstChargeDay);
        const chargeDate = d.toISOString().split('T')[0];
        const now = new Date();
        const status = d < now ? (Math.random() > 0.3 ? 'שולם' : 'שולם באיחור') : 'פתוח';
        const actualAmount = status !== 'פתוח' ? perPayment : null;
        const actualDate = status !== 'פתוח' ? chargeDate : null;
        await client.query(`INSERT INTO insurance_payments (policy_id, payment_number, charge_date, expected_amount, actual_amount, status, actual_payment_date) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [policyId, i+1, chargeDate, perPayment, actualAmount, status, actualDate]);
      }
      await client.query(`UPDATE insurance_policies SET payments_created=true WHERE id=$1`, [policyId]);
    };

    await createPayments(pol1.rows[0].id, 12, 7200, '2025-01-01', 1);
    await createPayments(pol2.rows[0].id, 12, 3600, '2025-02-01', 5);
    await createPayments(pol3.rows[0].id, 12, 9600, '2024-06-01', 1);
    await createPayments(pol4.rows[0].id, 12, 2400, '2025-03-01', 1);
    await createPayments(pol5.rows[0].id, 12, 5400, '2025-01-01', 15);

    // Tools
    await client.query(`INSERT INTO tools (serial_number, tool_type, vehicle_id, status, requires_inspection) VALUES
      ('TOOL-001', 'כלי חשמלי', $1, 'פעיל', false),
      ('TOOL-002', 'ציוד כבד', $2, 'פעיל', true),
      ('TOOL-003', 'כלי ידני', NULL, 'פעיל', false),
      ('TOOL-004', 'ציוד כבד', $3, 'בתיקון', true)
      ON CONFLICT (serial_number) DO NOTHING`,
      [v['23-456-78'], v['34-567-89'], v['12-345-67']]
    );

    // Work sites
    await client.query(`INSERT INTO work_sites (name, address, status) VALUES
      ('פרויקט נמל אשדוד', 'אשדוד, נמל', 'פעיל'),
      ('סלילת כביש 6 צפון', 'עוקף כביש 6', 'פעיל'),
      ('שיפוץ תחנת כח', 'חדרה', 'בהקמה')
      ON CONFLICT DO NOTHING`);

    // Diesel refunds
    await client.query(`INSERT INTO diesel_refunds (vehicle_id, period, liters, amount, refund_status, submission_date) VALUES
      ($1, '2025-10', 1800.5, 900.25, 'הוגש', '2025-11-15'),
      ($2, '2025-10', 2100.0, 1050.00, 'התקבל', '2025-11-15')`,
      [v['12-345-67'], v['34-567-89']]
    );

    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seed error:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
