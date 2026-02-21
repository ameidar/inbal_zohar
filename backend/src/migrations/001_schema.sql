-- Fleet Management System Schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reporter', -- admin/reporter
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  id_number TEXT UNIQUE,
  role TEXT,
  phone TEXT,
  email TEXT,
  start_date DATE,
  end_date DATE,
  active BOOLEAN DEFAULT true,
  salary_type TEXT,
  salary_amount NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  vehicle_number TEXT UNIQUE NOT NULL,
  nickname TEXT,
  asset_type TEXT, -- מכונית/משאית/נגרר/צמ"ה/כלי תפעולי
  fuel_type TEXT,  -- בנזין/סולר/אחר
  status TEXT DEFAULT 'פעיל', -- פעיל/מושבת/נמכר/בהקפאה
  manufacturer TEXT,
  model TEXT,
  year INT,
  chassis_number TEXT,
  purchase_date DATE,
  eligible_diesel_refund BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_employees (
  vehicle_id INT REFERENCES vehicles(id) ON DELETE CASCADE,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  is_responsible BOOLEAN DEFAULT false,
  PRIMARY KEY (vehicle_id, employee_id)
);

CREATE TABLE IF NOT EXISTS work_sites (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  status TEXT DEFAULT 'פעיל',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS tools (
  id SERIAL PRIMARY KEY,
  serial_number TEXT UNIQUE NOT NULL,
  tool_type TEXT,
  vehicle_id INT REFERENCES vehicles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'פעיל',
  requires_inspection BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tool_movements (
  id SERIAL PRIMARY KEY,
  tool_id INT REFERENCES tools(id) ON DELETE CASCADE,
  site_id INT REFERENCES work_sites(id) ON DELETE SET NULL,
  from_date DATE,
  to_date DATE,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS garages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  address TEXT,
  specialty TEXT,
  payment_terms TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  name TEXT,
  payment_type TEXT, -- אשראי/העברה בנקאית/הו"ק/צ'ק
  last_4_digits TEXT,
  charge_day INT,
  company TEXT,
  account_comprehensive TEXT,
  account_mandatory TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS maintenance (
  id SERIAL PRIMARY KEY,
  vehicle_id INT REFERENCES vehicles(id) ON DELETE CASCADE,
  garage_id INT REFERENCES garages(id) ON DELETE SET NULL,
  maintenance_type TEXT,
  maintenance_date DATE,
  odometer INT,
  description TEXT,
  cost NUMERIC(12,2),
  payment_method_id INT REFERENCES payment_methods(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'פתוח',
  next_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspections (
  id SERIAL PRIMARY KEY,
  vehicle_id INT REFERENCES vehicles(id) ON DELETE CASCADE,
  inspection_type TEXT,
  inspection_date DATE,
  next_inspection_date DATE,
  inspector TEXT,
  cost NUMERIC(12,2),
  passed BOOLEAN,
  document_url TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS fuel_cards (
  id SERIAL PRIMARY KEY,
  card_number TEXT UNIQUE NOT NULL,
  supplier TEXT,
  vehicle_id INT REFERENCES vehicles(id) ON DELETE SET NULL,
  asset_type TEXT,
  status TEXT DEFAULT 'פעיל',
  fuel_type TEXT,
  daily_limit NUMERIC(12,2),
  monthly_limit NUMERIC(12,2),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS fuel_invoices (
  id SERIAL PRIMARY KEY,
  supplier TEXT,
  period TEXT, -- "2024-01"
  invoice_date DATE,
  total_liters_diesel NUMERIC(12,3),
  total_amount_diesel NUMERIC(12,2),
  total_liters_petrol NUMERIC(12,3),
  total_amount_petrol NUMERIC(12,2),
  total_amount NUMERIC(12,2),
  file_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_invoice_lines (
  id SERIAL PRIMARY KEY,
  fuel_invoice_id INT REFERENCES fuel_invoices(id) ON DELETE CASCADE,
  vehicle_id INT REFERENCES vehicles(id) ON DELETE SET NULL,
  vehicle_number_raw TEXT,
  period TEXT,
  fuel_type TEXT,
  liters NUMERIC(12,3),
  amount NUMERIC(12,2),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS security_companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS vehicle_security (
  id SERIAL PRIMARY KEY,
  vehicle_id INT REFERENCES vehicles(id) ON DELETE CASCADE,
  company_id INT REFERENCES security_companies(id) ON DELETE SET NULL,
  security_type TEXT,
  installation_date DATE,
  renewal_date DATE,
  subscription_fee NUMERIC(12,2),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS insurance_policies (
  id SERIAL PRIMARY KEY,
  vehicle_id INT REFERENCES vehicles(id) ON DELETE SET NULL,
  tool_id INT REFERENCES tools(id) ON DELETE SET NULL,
  policy_number TEXT,
  coverage_type TEXT,
  insurer TEXT,
  start_date DATE,
  expiry_date DATE,
  total_premium NUMERIC(12,2),
  num_payments INT DEFAULT 1,
  first_charge_day INT DEFAULT 1,
  charge_method_id INT REFERENCES payment_methods(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'פעילה',
  payments_created BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insurance_payments (
  id SERIAL PRIMARY KEY,
  policy_id INT REFERENCES insurance_policies(id) ON DELETE CASCADE,
  payment_number INT,
  charge_date DATE,
  expected_amount NUMERIC(12,2),
  actual_amount NUMERIC(12,2),
  status TEXT DEFAULT 'פתוח',
  actual_payment_date DATE,
  receipt_url TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS diesel_refunds (
  id SERIAL PRIMARY KEY,
  vehicle_id INT REFERENCES vehicles(id) ON DELETE CASCADE,
  period TEXT,
  liters NUMERIC(12,3),
  amount NUMERIC(12,2),
  refund_status TEXT DEFAULT 'יופצ',
  submission_date DATE,
  actual_receipt_date DATE,
  notes TEXT
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_inspections_vehicle ON inspections(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_cards_vehicle ON fuel_cards(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_lines_invoice ON fuel_invoice_lines(fuel_invoice_id);
CREATE INDEX IF NOT EXISTS idx_insurance_payments_policy ON insurance_payments(policy_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_vehicle ON insurance_policies(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_security_vehicle ON vehicle_security(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_diesel_refunds_vehicle ON diesel_refunds(vehicle_id);
