const router = require('express').Router({ mergeParams: true });
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const { id } = req.params;
    const [vehicle, documents, fuelCards, employees, inspections] = await Promise.all([
      pool.query('SELECT * FROM vehicles WHERE id=$1', [id]),
      pool.query('SELECT * FROM vehicle_documents WHERE linked_entity_type=$1 AND linked_entity_id=$2', ['Vehicle', id]),
      pool.query("SELECT * FROM fuel_cards WHERE vehicle_id=$1 AND status='פעיל'", [id]),
      pool.query('SELECT e.*, ve.is_responsible FROM employees e JOIN vehicle_employees ve ON ve.employee_id=e.id WHERE ve.vehicle_id=$1', [id]),
      pool.query('SELECT * FROM inspections WHERE vehicle_id=$1 ORDER BY next_inspection_date ASC', [id]),
    ]);

    const v = vehicle.rows[0];
    if (!v) return res.status(404).json({ error: 'Vehicle not found' });

    const missingDocuments = [];
    const missingDates = [];
    const missingAssignments = [];
    const missingDetails = [];

    // Documents
    if (documents.rows.length === 0) {
      missingDocuments.push({ field: 'documents', label: 'אין מסמכים מצורפים לרכב', severity: 'medium', tab: 'documents', anchor: 'documents' });
    }

    // Missing dates
    if (!inspections.rows.length) {
      missingDates.push({ field: 'inspection_date', label: 'אין רישום בדיקות', severity: 'high', tab: 'inspections', anchor: 'inspections' });
    } else {
      const latest = inspections.rows[0];
      if (!latest.next_inspection_date) {
        missingDates.push({ field: 'next_inspection_date', label: 'חסר תאריך בדיקה הבאה', severity: 'high', tab: 'inspections', anchor: 'inspections' });
      }
    }

    if (!v.purchase_date) {
      missingDates.push({ field: 'purchase_date', label: 'חסר תאריך רכישה', severity: 'low', tab: 'overview', anchor: 'purchase_date' });
    }

    // Assignments
    const responsible = employees.rows.filter(e => e.is_responsible);
    if (responsible.length === 0) {
      missingAssignments.push({ field: 'responsible_employee', label: 'אין עובד אחראי משויך', severity: 'high', tab: 'overview', anchor: 'employees' });
    }

    if (fuelCards.rows.length === 0 && v.fuel_type !== 'אחר') {
      missingAssignments.push({ field: 'fuel_card', label: 'אין כרטיס דלק פעיל', severity: 'medium', tab: 'overview', anchor: 'fuel_cards' });
    }

    // Details
    if (!v.manufacturer) missingDetails.push({ field: 'manufacturer', label: 'חסר יצרן', severity: 'medium', tab: 'overview', anchor: 'manufacturer' });
    if (!v.model) missingDetails.push({ field: 'model', label: 'חסר דגם', severity: 'medium', tab: 'overview', anchor: 'model' });
    if (!v.year) missingDetails.push({ field: 'year', label: 'חסרת שנת ייצור', severity: 'medium', tab: 'overview', anchor: 'year' });
    if (!v.chassis_number) missingDetails.push({ field: 'chassis_number', label: 'חסר מספר שלדה (VIN)', severity: 'low', tab: 'overview', anchor: 'chassis_number' });
    if (!v.image_url) missingDetails.push({ field: 'image_url', label: 'אין תמונה לרכב', severity: 'low', tab: 'overview', anchor: 'image_url' });

    const totalMissing = missingDocuments.length + missingDates.length + missingAssignments.length + missingDetails.length;
    const highCount = [...missingDocuments, ...missingDates, ...missingAssignments, ...missingDetails].filter(i => i.severity === 'high').length;

    res.json({
      vehicle_id: parseInt(id),
      vehicle_number: v.vehicle_number,
      total_missing: totalMissing,
      high_severity_count: highCount,
      missingDocuments,
      missingDates,
      missingAssignments,
      missingDetails
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
