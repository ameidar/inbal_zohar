# Fleet Management — External API Integration Guide

## Overview

The Fleet Management system exposes a REST API for external integrations (Make, n8n, custom systems, etc.).

- **Base URL:** `http://localhost:3010/api/v1` *(replace with production hostname)*
- **Authentication:** `X-API-Key` header
- **Format:** JSON

---

## Authentication

All requests to `/api/v1/*` must include an API key in the header:

```
X-API-Key: fleet_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Alternative:** query param `?api_key=fleet_xxx...`

API keys are managed by admins via the admin panel.

---

## Endpoints

### 🚗 Vehicles

#### List vehicles
```http
GET /api/v1/vehicles
X-API-Key: <your-key>
```

**Query params (all optional):**
| Param | Example | Description |
|-------|---------|-------------|
| `status` | `פעיל` | Filter by vehicle status |
| `asset_type` | `מכונית` | Filter by asset type |
| `q` | `ford` | Free-text search (number/nickname/manufacturer) |

**Response:**
```json
{
  "count": 39,
  "data": [
    {
      "id": 1,
      "vehicle_number": "1263",
      "nickname": "...",
      "asset_type": "מכונית",
      "status": "פעיל",
      "manufacturer": "Ford",
      "model": "Transit",
      "year": 2021,
      "responsible_employee": "ישראל ישראלי",
      "next_maintenance_date": "2026-03-15",
      "next_inspection_date": "2026-04-01",
      "policy_expiry_date": "2026-12-31"
    }
  ]
}
```

#### Get single vehicle (full detail)
```http
GET /api/v1/vehicles/:id
X-API-Key: <your-key>
```

Returns vehicle + all related: employees, maintenance history, inspections, insurance policies.

---

### 👷 Employees

```http
GET /api/v1/employees
X-API-Key: <your-key>
```

**Query params:**
| Param | Example | Description |
|-------|---------|-------------|
| `active` | `true` | Filter active/inactive |
| `q` | `שם` | Search by name/ID/phone |

---

### 🔧 Maintenance

```http
GET /api/v1/maintenance
X-API-Key: <your-key>
```

**Query params:**
| Param | Example | Description |
|-------|---------|-------------|
| `vehicle_id` | `5` | Filter by vehicle |
| `status` | `הושלם` | Filter by status |
| `from` | `2026-01-01` | Date from (YYYY-MM-DD) |
| `to` | `2026-12-31` | Date to (YYYY-MM-DD) |

---

### 🔍 Inspections

```http
GET /api/v1/inspections
X-API-Key: <your-key>
```

**Query params:** `vehicle_id`, `from`, `to`

---

### 🛡️ Insurance

```http
GET /api/v1/insurance
X-API-Key: <your-key>
```

**Query params:**
| Param | Example | Description |
|-------|---------|-------------|
| `vehicle_id` | `5` | Filter by vehicle |
| `status` | `פעילה` | Filter by policy status |

---

### ⛽ Fuel Cards

```http
GET /api/v1/fuel-cards
X-API-Key: <your-key>
```

**Query params:** `vehicle_id`

---

### 📊 Summary / Dashboard

```http
GET /api/v1/summary
X-API-Key: <your-key>
```

Returns aggregated data for dashboard widgets:

```json
{
  "vehicles_by_status": [
    { "status": "פעיל", "count": "35" }
  ],
  "upcoming_maintenance": [...],   // next 30 days
  "expiring_insurance": [...],     // next 60 days
  "failed_inspections": [...]      // last 20 failed
}
```

---

## Managing API Keys (Admin Only)

Requires admin JWT login via `POST /api/auth/login`.

### List all keys
```http
GET /api/admin/api-keys
Authorization: Bearer <jwt-token>
```

### Create new key
```http
POST /api/admin/api-keys
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "Make Integration",
  "scopes": ["read"]
}
```

⚠️ **The raw key is returned only once.** Store it securely — it cannot be recovered.

### Revoke a key
```http
DELETE /api/admin/api-keys/:id
Authorization: Bearer <jwt-token>
```

---

## Example: Make (Integromat) HTTP Module

1. Create an **HTTP → Make a request** module
2. URL: `http://<host>:3010/api/v1/summary`
3. Method: `GET`
4. Headers: add `X-API-Key` → your key
5. Parse response as JSON

---

## Example: n8n HTTP Request Node

- Method: `GET`
- URL: `http://<host>:3010/api/v1/vehicles?status=פעיל`
- Authentication: `Header Auth`
  - Name: `X-API-Key`
  - Value: your key

---

## Error Codes

| Status | Meaning |
|--------|---------|
| `401` | Missing or invalid API key |
| `403` | Scope not allowed |
| `404` | Resource not found |
| `500` | Server error |
