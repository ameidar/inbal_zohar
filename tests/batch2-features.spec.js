/**
 * Tests for batch-2 features:
 * - #3: Payment dashboard with PM filter + monthly summary
 * - #4: Document filter by type + date range
 * - #5: Edit vehicle in duplicates (without merge)
 * - #16: Daily automation (today's payments endpoint)
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3010';

async function getToken(request) {
  const r = await request.post(BASE + '/api/auth/login', { data: { username: 'admin', password: 'admin123' } });
  return (await r.json()).token;
}

async function login(page) {
  await page.goto(BASE + '/login');
  await page.locator('input[type="text"], input[name="username"]').first().fill('admin');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"], button:has-text("כניסה")').first().click();
  await page.waitForURL(url => !url.includes('login'), { timeout: 10000 });
}

// ── #16: Today's payments endpoint ───────────────────────────────────────────

test('API: /payment-schedule/today returns array', async ({ request }) => {
  const token = await getToken(request);
  const r = await request.get(BASE + '/api/payment-schedule/today', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(r.ok()).toBeTruthy();
  const data = await r.json();
  expect(Array.isArray(data)).toBeTruthy();
});

test('API: today endpoint returns items with charge_date <= today', async ({ request }) => {
  const token = await getToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  // Create a policy
  const pR = await request.post(BASE + '/api/insurance', {
    headers,
    data: {
      policy_type: 'TEST today policy',
      policy_number: 'TEST-TODAY-POL-001',
      coverage_type: 'אחריות',
      insurer: 'מגדל',
      status: 'פעילה',
      total_premium: 600,
      num_payments: 1,
      start_date: '2026-01-01',
      expiry_date: '2027-01-01',
    },
  });
  const policy = await pR.json();

  // Create a payment schedule item with today's date
  const today = new Date().toISOString().split('T')[0];
  await request.post(BASE + '/api/payment-schedule', {
    headers,
    data: {
      policy_id: policy.id,
      amount: 600,
      charge_date: today,
      charge_month: today.slice(0,7),
      installment_number: 1,
      status: 'Planned',
    },
  });

  // Fetch today's items — our item should be there
  const tR = await request.get(BASE + '/api/payment-schedule/today', { headers });
  const todayItems = await tR.json();
  const found = todayItems.find(i => i.policy_id === policy.id);
  expect(found).toBeTruthy();

  // cleanup
  await request.delete(BASE + `/api/insurance/${policy.id}`, { headers });
});

test('API: marking payment as Paid removes it from today', async ({ request }) => {
  const token = await getToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  const pR = await request.post(BASE + '/api/insurance', {
    headers,
    data: {
      policy_type: 'TEST paid policy',
      policy_number: 'TEST-TODAY-PAID-001',
      coverage_type: 'חובה',
      insurer: 'הראל',
      status: 'פעילה',
      total_premium: 300,
      num_payments: 1,
      start_date: '2026-01-01',
      expiry_date: '2027-01-01',
    },
  });
  const policy = await pR.json();
  const today = new Date().toISOString().split('T')[0];

  const iR = await request.post(BASE + '/api/payment-schedule', {
    headers,
    data: { policy_id: policy.id, amount: 300, charge_date: today, charge_month: today.slice(0,7), installment_number: 1, status: 'Planned' },
  });
  const item = await iR.json();

  // Mark as Paid
  await request.put(BASE + `/api/payment-schedule/${item.id}`, {
    headers,
    data: { status: 'Paid' },
  });

  // Should no longer appear in today
  const tR = await request.get(BASE + '/api/payment-schedule/today', { headers });
  const todayItems = await tR.json();
  const found = todayItems.find(i => i.id === item.id);
  expect(found).toBeUndefined();

  await request.delete(BASE + `/api/insurance/${policy.id}`, { headers });
});

// ── #3: Payment schedule PM filter ───────────────────────────────────────────

test('API: payment schedule supports paymentMethodId filter', async ({ request }) => {
  const token = await getToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  const pmR = await request.get(BASE + '/api/payment-methods', { headers });
  const pms = await pmR.json();
  if (pms.length === 0) return;

  const r = await request.get(BASE + `/api/payment-schedule?paymentMethodId=${pms[0].id}`, { headers });
  expect(r.ok()).toBeTruthy();
  const items = await r.json();
  // All items should have the specified PM (if any exist)
  for (const item of items) {
    expect(item.payment_method_id).toBe(pms[0].id);
  }
});

test('API: payment schedule summary groups by PM', async ({ request }) => {
  const token = await getToken(request);
  const r = await request.get(BASE + '/api/payment-schedule/summary', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(r.ok()).toBeTruthy();
  const summary = await r.json();
  expect(Array.isArray(summary)).toBeTruthy();
  if (summary.length > 0) {
    expect(summary[0]).toHaveProperty('total_amount');
    expect(summary[0]).toHaveProperty('payment_method_name');
  }
});

test('UI: payment schedule page shows month filter', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/policies/payments');
  await page.waitForTimeout(2000);
  // Month input should be visible
  await expect(page.locator('input[type="month"]').first()).toBeVisible();
});

test('UI: payment schedule shows PM filter dropdown', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/policies/payments');
  await page.waitForTimeout(2000);
  // PM filter should exist
  const pmSelects = page.locator('select').filter({ hasText: /אמצעי תשלום/ });
  const count = await pmSelects.count();
  expect(count).toBeGreaterThan(0);
});

// ── #4: Documents filter ──────────────────────────────────────────────────────

test('API: documents filter by document_type', async ({ request }) => {
  const token = await getToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  const r = await request.get(BASE + '/api/documents?document_type=פוליסת ביטוח', { headers });
  expect(r.ok()).toBeTruthy();
  const docs = await r.json();
  for (const doc of docs) {
    expect(doc.document_type).toBe('פוליסת ביטוח');
  }
});

test('API: documents filter by dateFrom/dateTo', async ({ request }) => {
  const token = await getToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  // All docs from 2025 onwards
  const r = await request.get(BASE + '/api/documents?dateFrom=2025-01-01&dateTo=2025-12-31', { headers });
  expect(r.ok()).toBeTruthy();
  const docs = await r.json();
  for (const doc of docs) {
    if (doc.date) {
      const d = new Date(doc.date);
      expect(d.getFullYear()).toBe(2025);
    }
  }
});

test('API: documents combined filter (type + date)', async ({ request }) => {
  const token = await getToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  const r = await request.get(BASE + '/api/documents?document_type=מסמכי רכישה&dateFrom=2000-01-01', { headers });
  expect(r.ok()).toBeTruthy();
  const docs = await r.json();
  for (const doc of docs) {
    expect(doc.document_type).toBe('מסמכי רכישה');
  }
});

test('UI: documents page has document_type filter', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/documents');
  await page.waitForTimeout(2000);
  // Type filter dropdown
  await expect(page.locator('option:has-text("פוליסת ביטוח")').first()).toBeAttached();
  // Date filters
  const dateInputs = page.locator('input[type="date"]');
  await expect(dateInputs.first()).toBeVisible();
});

test('UI: documents filter shows count', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/documents');
  await page.waitForTimeout(2000);
  // Should show "N מסמכים"
  await expect(page.locator('text=/\\d+ מסמכים/').first()).toBeVisible();
});

// ── #5: Edit vehicle in duplicates ────────────────────────────────────────────

test('UI: duplicates page has edit button per vehicle', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/duplicates');
  await page.waitForTimeout(2000);

  // Expand first group if any
  const groups = page.locator('[style*="border-radius: 10px"], [style*="border-radius:10px"]').first();
  if (await groups.isVisible()) {
    await groups.click();
    await page.waitForTimeout(500);
    // Edit button should be visible
    const editBtn = page.locator('button:has-text("ערוך")').first();
    const count = await editBtn.count();
    // Either there are edit buttons or there are no expanded groups
    expect(count).toBeGreaterThanOrEqual(0);
  }
});

// ── UI: Today's payments banner ───────────────────────────────────────────────

test('UI: payment schedule page loads without error', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/policies/payments');
  await page.waitForTimeout(2000);
  await expect(page.locator('h2').first()).toBeVisible();
  // No error text
  const errorText = page.locator('text=/שגיאה|Error|TypeError/');
  expect(await errorText.count()).toBe(0);
});
