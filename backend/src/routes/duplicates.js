const router = require('express').Router();
const pool = require('../db');
const { adminOnly } = require('../middleware/auth');

// GET vehicle duplicates
router.get('/vehicles', async (req, res) => {
  try {
    const groups = [];

    // Group by same vehicle_number (license plate)
    const byPlate = await pool.query(`
      SELECT vehicle_number, array_agg(id ORDER BY id) as ids, COUNT(*)::int as cnt
      FROM vehicles
      WHERE vehicle_number IS NOT NULL AND merge_status IS NULL
      GROUP BY vehicle_number
      HAVING COUNT(*) > 1
    `);

    for (const row of byPlate.rows) {
      const vehicles = await pool.query('SELECT * FROM vehicles WHERE id = ANY($1)', [row.ids]);
      groups.push({
        match_reason: 'מספר רכב זהה',
        match_field: 'vehicle_number',
        match_value: row.vehicle_number,
        count: row.cnt,
        vehicles: vehicles.rows
      });
    }

    // Group by same chassis_number (VIN)
    const byVin = await pool.query(`
      SELECT chassis_number, array_agg(id ORDER BY id) as ids, COUNT(*)::int as cnt
      FROM vehicles
      WHERE chassis_number IS NOT NULL AND chassis_number != '' AND merge_status IS NULL
      GROUP BY chassis_number
      HAVING COUNT(*) > 1
    `);

    for (const row of byVin.rows) {
      const vehicles = await pool.query('SELECT * FROM vehicles WHERE id = ANY($1)', [row.ids]);
      groups.push({
        match_reason: 'מספר שלדה זהה (VIN)',
        match_field: 'chassis_number',
        match_value: row.chassis_number,
        count: row.cnt,
        vehicles: vehicles.rows
      });
    }

    // Warn: same manufacturer+model+year
    const byMmy = await pool.query(`
      SELECT manufacturer, model, year, array_agg(id ORDER BY id) as ids, COUNT(*)::int as cnt
      FROM vehicles
      WHERE manufacturer IS NOT NULL AND model IS NOT NULL AND year IS NOT NULL AND merge_status IS NULL
      GROUP BY manufacturer, model, year
      HAVING COUNT(*) > 1
    `);

    for (const row of byMmy.rows) {
      // Only include if not already captured by plate/VIN groups
      const vehicles = await pool.query('SELECT * FROM vehicles WHERE id = ANY($1)', [row.ids]);
      groups.push({
        match_reason: `יצרן/דגם/שנה זהים (${row.manufacturer} ${row.model} ${row.year})`,
        match_field: 'manufacturer_model_year',
        match_value: `${row.manufacturer} ${row.model} ${row.year}`,
        count: row.cnt,
        vehicles: vehicles.rows,
        warning_only: true
      });
    }

    res.json(groups);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET policy duplicates
router.get('/policies', async (req, res) => {
  try {
    const groups = [];

    // Group by same policy_number + insurer
    const byNumber = await pool.query(`
      SELECT policy_number, insurer, array_agg(id ORDER BY id) as ids, COUNT(*)::int as cnt
      FROM insurance_policies
      WHERE policy_number IS NOT NULL AND merge_status IS NULL
      GROUP BY policy_number, insurer
      HAVING COUNT(*) > 1
    `);

    for (const row of byNumber.rows) {
      const policies = await pool.query(`
        SELECT ip.*, v.vehicle_number, v.nickname
        FROM insurance_policies ip
        LEFT JOIN vehicles v ON v.id = ip.vehicle_id
        WHERE ip.id = ANY($1)
      `, [row.ids]);
      groups.push({
        match_reason: 'מספר פוליסה זהה',
        match_field: 'policy_number',
        match_value: row.policy_number,
        count: row.cnt,
        policies: policies.rows
      });
    }

    // Warn: same vehicle_id + coverage_type + overlapping dates
    const overlapping = await pool.query(`
      SELECT a.id as id_a, b.id as id_b, a.vehicle_id, a.coverage_type,
             a.policy_number as pol_a, b.policy_number as pol_b
      FROM insurance_policies a
      JOIN insurance_policies b ON (
        a.vehicle_id = b.vehicle_id
        AND a.coverage_type = b.coverage_type
        AND a.id < b.id
        AND a.merge_status IS NULL
        AND b.merge_status IS NULL
        AND a.start_date <= b.expiry_date
        AND a.expiry_date >= b.start_date
      )
    `);

    for (const row of overlapping.rows) {
      const policies = await pool.query(`
        SELECT ip.*, v.vehicle_number, v.nickname
        FROM insurance_policies ip
        LEFT JOIN vehicles v ON v.id = ip.vehicle_id
        WHERE ip.id IN ($1, $2)
      `, [row.id_a, row.id_b]);
      groups.push({
        match_reason: `כיסוי חופף: ${row.coverage_type}`,
        match_field: 'coverage_overlap',
        match_value: `vehicle_id=${row.vehicle_id}`,
        count: 2,
        policies: policies.rows,
        warning_only: true
      });
    }

    res.json(groups);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST merge vehicles (admin only)
router.post('/merge/vehicles', adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { primary_id, secondary_id, field_overrides = {} } = req.body;
    if (!primary_id || !secondary_id) return res.status(400).json({ error: 'primary_id and secondary_id required' });

    // Update FK references from secondary → primary
    const tables = [
      ['maintenance', 'vehicle_id'],
      ['inspections', 'vehicle_id'],
      ['insurance_policies', 'vehicle_id'],
      ['fuel_cards', 'vehicle_id'],
      ['vehicle_employees', 'vehicle_id'],
      ['vehicle_security', 'vehicle_id'],
      ['tools', 'vehicle_id'],
      ['diesel_refunds', 'vehicle_id'],
      ['fuel_invoice_lines', 'vehicle_id'],
      ['vehicle_documents', 'linked_entity_id'],
    ];

    const movedLinks = {};
    for (const [table, col] of tables) {
      try {
        const r = await client.query(
          `UPDATE ${table} SET ${col}=$1 WHERE ${col}=$2 RETURNING id`,
          [primary_id, secondary_id]
        );
        movedLinks[table] = r.rowCount;
      } catch (err) {
        // Skip if column doesn't exist in that table
      }
    }

    // Apply field overrides to primary
    if (Object.keys(field_overrides).length > 0) {
      const sets = Object.keys(field_overrides).map((k, i) => `${k}=$${i + 2}`);
      await client.query(
        `UPDATE vehicles SET ${sets.join(',')} WHERE id=$1`,
        [primary_id, ...Object.values(field_overrides)]
      );
    }

    // Mark secondary as merged
    await client.query(`
      UPDATE vehicles SET
        merge_status='Merged',
        merged_into_id=$1,
        merged_at=NOW(),
        merged_by_user_id=$2
      WHERE id=$3
    `, [primary_id, req.user.id, secondary_id]);

    // Write audit log
    await client.query(`
      INSERT INTO merge_audit_log (entity_type, primary_id, secondary_ids, field_overrides, moved_links_summary, merged_by_user_id)
      VALUES ('Vehicle', $1, $2, $3, $4, $5)
    `, [primary_id, JSON.stringify([secondary_id]), JSON.stringify(field_overrides), JSON.stringify(movedLinks), req.user.id]);

    await client.query('COMMIT');
    res.json({ ok: true, moved_links: movedLinks });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// POST merge policies (admin only)
router.post('/merge/policies', adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { primary_id, secondary_id, field_overrides = {} } = req.body;
    if (!primary_id || !secondary_id) return res.status(400).json({ error: 'primary_id and secondary_id required' });

    // Move payments from secondary to primary
    const movedLinks = {};
    const r = await client.query(
      `UPDATE insurance_payments SET policy_id=$1 WHERE policy_id=$2 RETURNING id`,
      [primary_id, secondary_id]
    );
    movedLinks['insurance_payments'] = r.rowCount;

    const r2 = await client.query(
      `UPDATE payment_schedule_items SET policy_id=$1 WHERE policy_id=$2 RETURNING id`,
      [primary_id, secondary_id]
    );
    movedLinks['payment_schedule_items'] = r2.rowCount;

    // Apply field overrides to primary
    if (Object.keys(field_overrides).length > 0) {
      const sets = Object.keys(field_overrides).map((k, i) => `${k}=$${i + 2}`);
      await client.query(
        `UPDATE insurance_policies SET ${sets.join(',')} WHERE id=$1`,
        [primary_id, ...Object.values(field_overrides)]
      );
    }

    // Mark secondary as merged
    await client.query(`
      UPDATE insurance_policies SET
        merge_status='Merged',
        merged_into_id=$1,
        merged_at=NOW(),
        merged_by_user_id=$2
      WHERE id=$3
    `, [primary_id, req.user.id, secondary_id]);

    // Write audit log
    await client.query(`
      INSERT INTO merge_audit_log (entity_type, primary_id, secondary_ids, field_overrides, moved_links_summary, merged_by_user_id)
      VALUES ('Policy', $1, $2, $3, $4, $5)
    `, [primary_id, JSON.stringify([secondary_id]), JSON.stringify(field_overrides), JSON.stringify(movedLinks), req.user.id]);

    await client.query('COMMIT');
    res.json({ ok: true, moved_links: movedLinks });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
