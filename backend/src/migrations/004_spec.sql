-- Add missing columns to existing payment_methods table
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS provider VARCHAR(100);

-- PaymentScheduleItems
CREATE TABLE IF NOT EXISTS payment_schedule_items (
  id SERIAL PRIMARY KEY,
  policy_id INT REFERENCES insurance_policies(id) ON DELETE CASCADE,
  payment_method_id INT REFERENCES payment_methods(id),
  amount NUMERIC(12,2) NOT NULL,
  charge_date DATE,
  charge_month VARCHAR(7),
  installment_number INT,
  status VARCHAR(20) DEFAULT 'Planned',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VehicleDocuments
CREATE TABLE IF NOT EXISTS vehicle_documents (
  id SERIAL PRIMARY KEY,
  document_type VARCHAR(100),
  linked_entity_type VARCHAR(50),
  linked_entity_id INT,
  file_url TEXT,
  date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ToolCategories
CREATE TABLE IF NOT EXISTS tool_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MergeAuditLog
CREATE TABLE IF NOT EXISTS merge_audit_log (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50),
  primary_id INT,
  secondary_ids JSONB,
  field_overrides JSONB,
  moved_links_summary JSONB,
  merged_by_user_id INT,
  merged_at TIMESTAMPTZ DEFAULT NOW()
);

-- OperatorLicenseDocs (separate from existing operator_licenses CRUD table)
CREATE TABLE IF NOT EXISTS operator_license_docs (
  id SERIAL PRIMARY KEY,
  start_date DATE,
  expiry_date DATE,
  status VARCHAR(20) DEFAULT 'Active',
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns to existing tables
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_lien BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS lien_to VARCHAR(200);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS merge_status VARCHAR(20);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS merged_into_id INT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS merged_by_user_id INT;

ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS merge_status VARCHAR(20);
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS merged_into_id INT;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS merged_by_user_id INT;

ALTER TABLE tools ADD COLUMN IF NOT EXISTS category_id INT REFERENCES tool_categories(id);
