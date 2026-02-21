# Fleet Management System — Build Task

Build a complete fleet management web application for an Israeli infrastructure company.
Language: Hebrew UI, English code.

## Tech Stack
- **Backend**: Node.js + Express + PostgreSQL (use `pg` package)
- **Frontend**: React (Vite) with RTL support for Hebrew
- **Auth**: JWT, two roles: `admin` and `reporter`
- **Port**: Backend on 3010, Frontend on 5180
- **DB**: PostgreSQL on localhost:5432, DB name `fleet_db`, user `fleet_user`, password `fleet123`

## Project Structure
```
fleet-management/
├── backend/
│   ├── src/
│   │   ├── db.js          # pg pool connection
│   │   ├── migrations/    # SQL migration files
│   │   ├── routes/        # Express routes per entity
│   │   ├── middleware/     # auth, error handling
│   │   └── index.js       # main server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/         # one page per main entity
│   │   ├── components/    # shared UI
│   │   ├── api/           # API client
│   │   └── App.jsx
│   └── package.json
└── docker-compose.yml
```

## Database Schema (Hebrew → English field names)

### employees
- id (serial PK)
- name (text)
- id_number (text unique) — ז.ת
- role (text) — מנכ"ל/מנהל צמ"ה/מנהלת משרד/מנהל צוות תקלות/מפעיל/חשמלאי/עובד כללי/מפעיל חיצוני/קבלן חיצוני
- phone (text)
- email (text)
- start_date (date)
- end_date (date)
- active (boolean default true)
- salary_type (text) — גלובלי/לפי ימי עבודה/שעתי/קבלן
- salary_amount (numeric)
- notes (text)
- created_at (timestamptz)

### vehicles (core entity)
- id (serial PK)
- vehicle_number (text unique) — מספר רכב
- nickname (text) — שם כלי/כינוי
- asset_type (text) — מכונית/משאית/נגרר/צמ"ה/כלי תפעולי
- fuel_type (text) — בנזין/סולר/אחר
- status (text) — פעיל/מושבת/נמכר/בהקפאה
- manufacturer (text)
- model (text)
- year (int)
- chassis_number (text)
- purchase_date (date)
- eligible_diesel_refund (boolean)
- notes (text)
- created_at (timestamptz)

### vehicle_employees (M2M)
- vehicle_id (FK → vehicles)
- employee_id (FK → employees)
- is_responsible (boolean)

### work_sites
- id (serial PK)
- name (text)
- address (text)
- status (text) — פעיל/סגור/בהקמה
- notes (text)

### tools
- id (serial PK)
- serial_number (text unique)
- tool_type (text) — כלי חשמלי/כלי ידני/ציוד כבד/אחר
- vehicle_id (FK → vehicles nullable)
- status (text) — פעיל/בתיקון/לא בשימוש/אבד
- requires_inspection (boolean)
- notes (text)

### tool_movements
- id (serial PK)
- tool_id (FK → tools)
- site_id (FK → work_sites)
- from_date (date)
- to_date (date)
- notes (text)

### garages
- id (serial PK)
- name (text unique)
- contact_name (text)
- phone (text)
- address (text)
- specialty (text)
- payment_terms (text) — שוטף 60/מזומן/צ'ק
- notes (text)

### maintenance (טיפולים)
- id (serial PK)
- vehicle_id (FK → vehicles)
- garage_id (FK → garages)
- maintenance_type (text) — טיפול תקופתי/תקלה/חירום/אחר
- maintenance_date (date)
- odometer (int)
- description (text)
- cost (numeric)
- payment_method_id (FK → payment_methods nullable)
- status (text) — פתוח/בוצע/בוטל
- next_date (date)
- notes (text)
- created_at (timestamptz)

### inspections (בדיקות רכב)
- id (serial PK)
- vehicle_id (FK → vehicles)
- inspection_type (text) — טסט/ריקורד/אחר
- inspection_date (date)
- next_inspection_date (date)
- inspector (text)
- cost (numeric)
- passed (boolean)
- document_url (text)
- notes (text)

### fuel_cards (כרטיסי דלק)
- id (serial PK)
- card_number (text unique)
- supplier (text) — סונול/פז/דלק/אחר
- vehicle_id (FK → vehicles nullable)
- asset_type (text)
- status (text) — פעיל/חסום/לא פעיל
- fuel_type (text) — סולר/בנזין/שניהם/אחר
- daily_limit (numeric)
- monthly_limit (numeric)
- notes (text)

### fuel_invoices (חשבוניות דלק)
- id (serial PK)
- supplier (text)
- period (text) — "2024-01" format
- invoice_date (date)
- total_liters_diesel (numeric)
- total_amount_diesel (numeric)
- total_liters_petrol (numeric)
- total_amount_petrol (numeric)
- total_amount (numeric)
- file_url (text)
- notes (text)
- created_at (timestamptz)

### fuel_invoice_lines (פירוט חשבונית לפי רכב)
- id (serial PK)
- fuel_invoice_id (FK → fuel_invoices)
- vehicle_id (FK → vehicles nullable)
- vehicle_number_raw (text) — raw from import
- period (text)
- fuel_type (text)
- liters (numeric)
- amount (numeric)
- notes (text)

### security_companies (חברות מיגון)
- id (serial PK)
- name (text)
- contact_name (text)
- phone (text)
- notes (text)

### vehicle_security (מיגון לרכב)
- id (serial PK)
- vehicle_id (FK → vehicles)
- company_id (FK → security_companies)
- security_type (text) — איתורן/אימובילייזר/מנעול/מצלמות/אחר
- installation_date (date)
- renewal_date (date)
- subscription_fee (numeric)
- notes (text)

### insurance_policies (פוליסות)
- id (serial PK)
- vehicle_id (FK → vehicles nullable)
- tool_id (FK → tools nullable)
- policy_name (text) — formula: vehicle + coverage_type
- policy_number (text)
- coverage_type (text) — חובה/מקיף/מקיף+ג'יפ/ג'יפ בלבד/ג'יפ+ג'יפ ג'/ג' בלבד/כל הסיכונים/כולל מגדל/לרהל/...
- insurer (text)
- start_date (date)
- expiry_date (date)
- total_premium (numeric)
- num_payments (int)
- first_charge_day (int) — day of month
- charge_method_id (FK → payment_methods nullable)
- status (text) — פעילה/הסתיימה/בוטלה
- payments_created (boolean default false)
- notes (text)
- created_at (timestamptz)

### insurance_payments (תשלומי ביטוח)
- id (serial PK)
- policy_id (FK → insurance_policies)
- payment_number (int) — 1,2,3...
- charge_date (date) — calculated from policy
- expected_amount (numeric)
- actual_amount (numeric)
- status (text) — פתוח/שולם/שולם באיחור
- actual_payment_date (date)
- receipt_url (text)
- notes (text)

### payment_methods (אמצעי תשלום)
- id (serial PK)
- name (text) — formula: type + last 4 digits
- payment_type (text) — אשראי/העברה בנקאית/הו"ק/צ'ק
- last_4_digits (text)
- charge_day (int)
- company (text) — ויזה/מקס/ישראכרד/בנק הפועלים/בנק לאומי/...
- account_comprehensive (text)
- account_mandatory (text)
- notes (text)

### diesel_refunds (רלו - החזרי סולר)
- id (serial PK)
- vehicle_id (FK → vehicles)
- period (text) — "2024-01" format
- liters (numeric)
- amount (numeric)
- refund_status (text) — יופצ/הוגש/התקבל/נדחה
- submission_date (date)
- actual_receipt_date (date)
- notes (text)

### users (system users)
- id (serial PK)
- username (text unique)
- password_hash (text)
- role (text) — admin/reporter
- full_name (text)
- created_at (timestamptz)

## Business Logic

### AUTO-CREATE insurance payments
When a new insurance_policy is created (or payments_created changes to true):
- Create N records in insurance_payments (N = num_payments)
- payment_number: 1..N
- charge_date: first_charge_day of month, starting from month of start_date, incrementing monthly
- expected_amount: total_premium / num_payments
- status: 'פתוח'
- Set policy.payments_created = true

Implement as a PostgreSQL trigger OR as a Node.js function called after INSERT/UPDATE on policy.

## API Routes (RESTful)
For each entity: GET /api/:entity, GET /api/:entity/:id, POST /api/:entity, PUT /api/:entity/:id, DELETE /api/:entity/:id

Special routes:
- POST /api/auth/login → returns JWT
- GET /api/dashboard/vehicles → vehicle list with computed fields (next maintenance, next inspection, policy expiry)
- GET /api/dashboard/alerts → vehicles with: expiring policies (<30d), past inspections, no fuel card, no responsible employee
- POST /api/fuel-invoices/:id/import-lines → accepts JSON array of lines, matches vehicle_number to vehicles table
- GET /api/dashboard/financial → monthly summary (insurance payments due, actual fuel costs, refunds)

## Auth Middleware
- JWT with 24h expiry
- Secret: "fleet_jwt_secret_2024"
- Admin: full CRUD
- Reporter: GET only + can update maintenance/inspection status

## Frontend Pages (Hebrew UI, RTL)
Use Tailwind CSS (or plain CSS with RTL). Keep it clean and simple.

### Pages:
1. **Login** — /login
2. **Dashboard** — / — show: alert cards (expiring soon, missing data), quick stats (active vehicles count, pending payments count, upcoming maintenance)
3. **Vehicles** — /vehicles — table + filter by status/type, click → detail page
4. **Vehicle Detail** — /vehicles/:id — tabs: כללי, טיפולים, בדיקות, כרטיסי דלק, ביטוח, מיגון, כלי עבודה
5. **Employees** — /employees — table, CRUD modal
6. **Maintenance** — /maintenance — table with filters, add/edit modal
7. **Inspections** — /inspections — table, add/edit
8. **Insurance** — /insurance — policies list, payments sub-table per policy
9. **Fuel** — /fuel — invoices list + line items
10. **Tools** — /tools — table + movements log
11. **Settings** — /settings — payment methods, garages, security companies

## Demo Data (IMPORTANT — populate with realistic Hebrew fake data)
After DB setup, insert demo data:
- 8 vehicles (mix of cars/trucks/machinery, various statuses)
- 6 employees (different roles)
- 4 garages
- 10 maintenance records
- 5 inspections
- 6 fuel cards
- 3 fuel invoices with line items
- 5 insurance policies with auto-created payments
- 3 security companies + vehicle security records
- 4 tools
- 2 diesel refund records
- 2 payment methods
- 1 admin user (admin/admin123) + 1 reporter (reporter/report123)

## Docker Compose
```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: fleet_db
      POSTGRES_USER: fleet_user
      POSTGRES_PASSWORD: fleet123
    ports:
      - "5433:5432"  # use 5433 externally to avoid conflict with existing pg
    volumes:
      - fleet_db_data:/var/lib/postgresql/data
  
  backend:
    build: ./backend
    environment:
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: fleet_db
      DB_USER: fleet_user
      DB_PASSWORD: fleet123
      PORT: 3010
      JWT_SECRET: fleet_jwt_secret_2024
    ports:
      - "3010:3010"
    depends_on:
      - db

volumes:
  fleet_db_data:
```

## Startup Script
Create `start.sh`:
```bash
#!/bin/bash
docker compose up -d db
sleep 3
cd backend && npm install && node src/migrations/run.js && node src/seed.js &
cd frontend && npm install && npm run build
# serve frontend dist with backend static middleware
```

When completely finished, run this command to notify:
openclaw system event --text "Done: Fleet management system built. Backend on 3010, frontend built. Run docker-compose up in /home/opc/projects/fleet-management" --mode now
