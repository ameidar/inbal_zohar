require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { auth, adminOnly } = require('./middleware/auth');
const { apiKeyAuth } = require('./middleware/apiKey');
const crud = require('./routes/crud');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth
app.use('/api/auth', require('./routes/auth'));

// External API v1 (API Key auth)
app.use('/api/v1', apiKeyAuth, require('./routes/api-v1'));

// Admin: manage API keys (JWT + admin only)
app.use('/api/admin/api-keys', auth, adminOnly, require('./routes/api-keys'));

// Admin: manage webhook subscriptions (JWT + admin only)
app.use('/api/admin/webhooks', auth, adminOnly, require('./routes/webhooks'));

// Protected routes
app.use('/api/dashboard', auth, require('./routes/dashboard'));
app.use('/api/vehicles', auth, require('./routes/vehicles'));
app.use('/api/insurance', auth, require('./routes/insurance'));
app.use('/api/fuel', auth, require('./routes/fuel'));

// Generic CRUD routes
app.use('/api/employees', auth, crud('employees',
  ['name','id_number','role','phone','email','start_date','end_date','active','salary_type','salary_amount','notes'],
  { orderBy: 'name' }
));

app.use('/api/maintenance', auth, crud('maintenance',
  ['vehicle_id','garage_id','maintenance_type','maintenance_date','odometer','description','cost','payment_method_id','status','next_date','notes'],
  { orderBy: 'maintenance_date DESC' }
));

app.use('/api/inspections', auth, crud('inspections',
  ['vehicle_id','inspection_type','inspection_date','next_inspection_date','inspector','cost','passed','document_url','notes'],
  { orderBy: 'inspection_date DESC' }
));

app.use('/api/garages', auth, crud('garages',
  ['name','contact_name','phone','address','specialty','payment_terms','notes'],
  { orderBy: 'name' }
));

app.use('/api/tools', auth, crud('tools',
  ['serial_number','tool_type','vehicle_id','status','requires_inspection','notes'],
  { orderBy: 'serial_number' }
));

app.use('/api/work-sites', auth, crud('work_sites',
  ['name','address','status','notes'],
  { orderBy: 'name' }
));

app.use('/api/security-companies', auth, crud('security_companies',
  ['name','contact_name','phone','notes'],
  { orderBy: 'name' }
));

app.use('/api/vehicle-security', auth, crud('vehicle_security',
  ['vehicle_id','company_id','security_type','installation_date','renewal_date','subscription_fee','notes'],
  { orderBy: 'id' }
));

app.use('/api/payment-methods', auth, crud('payment_methods',
  ['name','payment_type','last_4_digits','charge_day','company','account_comprehensive','account_mandatory','notes'],
  { orderBy: 'name' }
));

app.use('/api/diesel-refunds', auth, crud('diesel_refunds',
  ['vehicle_id','period','liters','amount','refund_status','submission_date','actual_receipt_date','notes'],
  { orderBy: 'period DESC' }
));

app.use('/api/fuel-cards', auth, crud('fuel_cards',
  ['vehicle_id','card_number','supplier','fuel_type','status','daily_limit','monthly_limit','notes'],
  { orderBy: 'id' }
));

app.use('/api/operator-licenses', auth, crud('operator_licenses',
  ['license_number','license_type','issue_date','expiry_date','issuing_authority','status','notes'],
  { orderBy: 'expiry_date DESC' }
));

// Serve uploaded files
const uploadsPath = require('path').join(__dirname, '../uploads');
app.use('/uploads', require('express').static(uploadsPath));

// Serve frontend in production
const frontendDist = path.join(__dirname, '../../frontend/dist');
const frontendDist2 = path.join(__dirname, '../dist');
const distPath = require('fs').existsSync(frontendDist) ? frontendDist : frontendDist2;
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

const PORT = process.env.PORT || 3010;
app.listen(PORT, '0.0.0.0', () => console.log(`Fleet backend running on port ${PORT}`));
