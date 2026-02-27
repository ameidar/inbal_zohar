/**
 * Tests for spec-24-2-26 features:
 * - Standalone insurance policies (no vehicle, policy_type field)
 * - Purchase date field
 * - Payment schedule (bulk-replace + retrieval)
 * - Auto-expire policies
 * - Monthly cost summary banner
 * - Payment method column in insurance table
 * - Active/inactive separator row
 * - Policy type field shown only when no vehicle selected
 * - First charge date hint in modal
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3010';

// ── helpers ──────────────────────────────────────────────────────────────────

async function getToken(request) {
  const r = await request.post(BASE + '/api/auth/login', {
    data: { username: 'admin', password: 'admin123' },
  });
  const { token } = await r.json();
  return token;
}

async function login(page) {
  await page.goto(BASE + '/login');
  await page.locator('input[type="text"], input[name="username"]').first().fill('admin');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"], button:has-text("כניסה")').first().click();
  await page.waitForURL(url => !url.includes('login'), { timeout: 10000 });
}

// ── API: standalone policy (no vehicle) ─────────────────────────────────────

test('API: create standalone policy with policy_type', async ({ request }) => {
  const token = await getToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  const r = await request.post(BASE + '/api/insurance', {
    headers,
    data: {
      policy_type: 'פוליסת קבלנים',
      policy_number: 'TEST-STANDALONE-001',
      coverage_type: 'אחריות',
      insurer: 'מגדל',
      status: 'פעילה',
      total_premium: 6000,
      num_payments: 12,
      start_date: '2026-01-01',
      expiry_date: '2027-01-01',
      purchase_date: '2025-12-26',
    },
  });
  expect(r.ok()).toBeTruthy();
  const policy = await r.json();
  expect(policy.id).toBeTruthy();
  expect(policy.vehicle_id).toBeNull();
  expect(policy.policy_type).toBe('פוליסת קבלנים');

  // cleanup
  await request.delete(BASE + `/api/insurance/${policy.id}`, { headers });
});

test('API: standalone policy returned in GET list with policy_type', async ({ request }) => {
  const token = await getToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  // create
  const cr = await request.post(BASE + '/api/insurance', {
    headers,
    data: {
      policy_type: 'ביטוח עסק',
      policy_number: 'TEST-STANDALONE-002',
      coverage_type: 'רכוש',
      insurer: 'הפניקס',
      status: 'פעילה',
      total_premium: 4800,
      num_payments: 12,
      start_date: '2026-01-01',
      expiry_date: '2027-01-01',
      purchase_date: '2025-12-20',
    },
  });
  const created = await cr.json();

  // fetch list
  const lr = await request.get(BASE + '/api/insurance', { headers });
  expect(lr.ok()).toBeTruthy();
  const list = await lr.json();
  const found = list.find(p => p.id === created.id);
  expect(found).toBeTruthy();
  expect(found.policy_type).toBe('ביטוח עסק');
  expect(found.vehicle_id).toBeNull();

  // cleanup
  await request.delete(BASE + `/api/insurance/${created.id}`, { headers });
});

test('API: update policy_type via PUT', async ({ request }) => {
  const token = await getToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  const cr = await request.post(BASE + '/api/insurance', {
    headers,
    data: {
      policy_type: 'ביטוח נסיעות',
      policy_number: 'TEST-UPDATE-PT-001',
      coverage_type: 'אחריות',
      insurer: 'כלל',
      status: 'פעילה',
      total_premium: 2400,
      num_payments: 12,
      start_date: '2026-01-01',
      expiry_date: '2027-01-01',
    },
  });
  const created = await cr.json();

  const ur = await request.put(BASE + `/api/insurance/${created.id}`, {
    headers,
    data: { policy_type: 'ביטוח אחריות מקצועית' },
  });
  expect(ur.ok()).toBeTruthy();
  const updated = await ur.json();
  expect(updated.policy_type).toBe('ביטוח אחריות מקצועית');

  // cleanup
  await request.delete(BASE + `/api/insurance/${created.id}`, { headers });
});

// ── API: purchase_date ───────────────────────────────────────────────────────

test('API: create policy with purchase_date', async ({ request }) => {
  const token = await getToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  const r = await request.post(BASE + '/api/insurance', {
    headers,
    data: {
      policy_number: 'TEST-PURCHASE-DATE-001',
      coverage_type: 'חובה',
      insurer: 'מנורה',
      status: 'פעילה',
      total_premium: 3600,
      num_payments: 12,
      start_date: '2026-02-01',
      expiry_date: '2027-02-01',
      purchase_date: '2026-01-26',
    },
  });
  expect(r.ok()).toBeTruthy();
  const policy = await r.json();
  expect(policy.purchase_date).toContain('2026-01-26');

  // cleanup
  await request.delete(BASE + `/api/insurance/${policy.id}`, { headers });
});

test('API: update purchase_date', async ({ request }) => {
  const token = await getToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  const cr = await request.post(BASE + '/api/insurance', {
    headers,
    data: {
      policy_number: 'TEST-PURCHASE-DATE-002',
      coverage_type: 'חובה',
      insurer: 'הראל',
      status: 'פעילה',
      total_premium: 3600,
      num_payments: 12,
      start_date: '2026-02-01',
      expiry_date: '2027-02-01',
      purchase_date: '2026-01-20',
    },
  });
  const created = await cr.json();

  const ur = await request.put(BASE + `/api/insurance/${created.id}`, {
    headers,
    data: { purchase_date: '2026-01-28' },
  });
  expect(ur.ok()).toBeTruthy();
  const updated = await ur.json();
  expect(updated.purchase_date).toContain('2026-01-28');

  // cleanup
  await request.delete(BASE + `/api/insurance/${created.id}`, { headers });
});

// ── API: payment schedule ────────────────────────────────────────────────────

test('API: bulk-replace payment schedule and retrieve it', async ({ request }) => {
  const token = await getToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  // create policy
  const cr = await request.post(BASE + '/api/insurance', {
    headers,
    data: {
      policy_type: 'פוליסת ציוד',
      policy_number: 'TEST-SCHEDULE-001',
      coverage_type: 'רכוש',
      insurer: 'איילון',
      status: 'פעילה',
      total_premium: 1200,
      num_payments: 3,
      start_date: '2026-01-01',
      expiry_date: '2027-01-01',
      purchase_date: '2025-12-15',
    },
  });
  const policy = await cr.json();

  // bulk replace
  const items = [
    { installment_number: 1, amount: 400, charge_date: '2026-01-15', charge_month: '2026-01' },
    { installment_number: 2, amount: 400, charge_date: '2026-02-15', charge_month: '2026-02' },
    { installment_number: 3, amount: 400, charge_date: '2026-03-15', charge_month: '2026-03' },
  ];
  const br = await request.post(BASE + `/api/payment-schedule/bulk-replace`, {
    headers,
    data: { policy_id: policy.id, items },
  });
  expect(br.ok()).toBeTruthy();

  // retrieve
  const gr = await request.get(BASE + `/api/insurance/${policy.id}/schedule`, { headers });
  expect(gr.ok()).toBeTruthy();
  const schedule = await gr.json();
  expect(schedule.length).toBe(3);
  expect(schedule[0].installment_number).toBe(1);
  expect(schedule[0].amount).toBe('400.00');

  // cleanup
  await request.delete(BASE + `/api/insurance/${policy.id}`, { headers });
});

test('API: bulk-replace replaces existing schedule atomically', async ({ request }) => {
  const token = await getToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  const cr = await request.post(BASE + '/api/insurance', {
    headers,
    data: {
      policy_type: 'פוליסת כלים',
      policy_number: 'TEST-SCHEDULE-REPLACE-001',
      coverage_type: 'רכוש',
      insurer: 'מגדל',
      status: 'פעילה',
      total_premium: 600,
      num_payments: 2,
      start_date: '2026-01-01',
      expiry_date: '2027-01-01',
    },
  });
  const policy = await cr.json();

  // first replace (2 items)
  await request.post(BASE + `/api/payment-schedule/bulk-replace`, {
    headers,
    data: {
      policy_id: policy.id,
      items: [
        { installment_number: 1, amount: 300, charge_date: '2026-01-01', charge_month: '2026-01' },
        { installment_number: 2, amount: 300, charge_date: '2026-02-01', charge_month: '2026-02' },
      ],
    },
  });

  // second replace (3 items — replaces, not appends)
  await request.post(BASE + `/api/payment-schedule/bulk-replace`, {
    headers,
    data: {
      policy_id: policy.id,
      items: [
        { installment_number: 1, amount: 200, charge_date: '2026-01-10', charge_month: '2026-01' },
        { installment_number: 2, amount: 200, charge_date: '2026-02-10', charge_month: '2026-02' },
        { installment_number: 3, amount: 200, charge_date: '2026-03-10', charge_month: '2026-03' },
      ],
    },
  });

  const gr = await request.get(BASE + `/api/insurance/${policy.id}/schedule`, { headers });
  const schedule = await gr.json();
  // must be 3, not 5 (old items deleted)
  expect(schedule.length).toBe(3);
  expect(schedule[2].charge_month).toBe('2026-03');

  await request.delete(BASE + `/api/insurance/${policy.id}`, { headers });
});

// ── API: auto-expire ─────────────────────────────────────────────────────────

test('API: expired policies get status הסתיימה on next GET', async ({ request }) => {
  const token = await getToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  // create a policy with past expiry
  const cr = await request.post(BASE + '/api/insurance', {
    headers,
    data: {
      policy_type: 'פוליסה ישנה',
      policy_number: 'TEST-EXPIRE-001',
      coverage_type: 'חובה',
      insurer: 'מגדל',
      status: 'פעילה',
      total_premium: 1000,
      num_payments: 1,
      start_date: '2024-01-01',
      expiry_date: '2024-12-31',
    },
  });
  const created = await cr.json();

  // GET insurance list triggers auto-expire
  await request.get(BASE + '/api/insurance', { headers });

  // fetch individual
  const gr = await request.get(BASE + `/api/insurance/${created.id}`, { headers });
  const policy = await gr.json();
  expect(policy.status).toBe('הסתיימה');

  // cleanup
  await request.delete(BASE + `/api/insurance/${created.id}`, { headers });
});

// ── UI: insurance page features ──────────────────────────────────────────────

test('UI: insurance page shows monthly summary banner', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/policies/list');
  await page.waitForTimeout(2000);
  // banner should contain ₪ symbol (total cost)
  const banner = page.locator('text=/₪.*חודש|עלות חודשית|סה"כ חודשי/');
  await expect(banner.first()).toBeVisible();
});

test('UI: insurance table has אמצעי תשלום column header', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/policies/list');
  await page.waitForTimeout(2000);
  await expect(page.locator('th, td').filter({ hasText: 'אמצעי תשלום' }).first()).toBeVisible();
});

test('UI: add policy modal has ללא רכב option', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/policies/list');
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("הוסף פוליסה")').first().click();
  await page.waitForTimeout(500);
  // vehicle dropdown must contain ללא רכב option
  await expect(page.locator('option:has-text("ללא רכב")').first()).toBeAttached();
});

test('UI: policy_type field appears when ללא רכב is selected', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/policies/list');
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("הוסף פוליסה")').first().click();
  await page.waitForTimeout(500);

  // select ללא רכב (empty value)
  const vehicleSelect = page.locator('select').filter({ hasText: 'ללא רכב' }).first();
  await vehicleSelect.selectOption('');

  // policy_type input should now be visible
  const policyTypeInput = page.locator('input[placeholder*="סוג פוליסה"], input[placeholder*="קבלנים"]').first();
  await expect(policyTypeInput).toBeVisible();
});

test('UI: policy_type field hidden when vehicle is selected', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/policies/list');
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("הוסף פוליסה")').first().click();
  await page.waitForTimeout(500);

  // select first actual vehicle (if any exist)
  const vehicleSelect = page.locator('select').filter({ hasText: 'ללא רכב' }).first();
  const options = vehicleSelect.locator('option');
  const optCount = await options.count();

  if (optCount > 1) {
    // pick the second option (first real vehicle)
    const secondOption = await options.nth(1).getAttribute('value');
    if (secondOption) {
      await vehicleSelect.selectOption(secondOption);
      const policyTypeInput = page.locator('input[placeholder*="סוג פוליסה"], input[placeholder*="קבלנים"]');
      await expect(policyTypeInput).toBeHidden();
    }
  } else {
    test.skip();
  }
});

test('UI: payment schedule section visible in add policy modal', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/policies/list');
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("הוסף פוליסה")').first().click();
  await page.waitForTimeout(500);
  // schedule section heading
  await expect(page.locator('text=/פריסת תשלומים/').first()).toBeVisible();
});

test('UI: purchase_date field visible in add policy modal', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/policies/list');
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("הוסף פוליסה")').first().click();
  await page.waitForTimeout(500);
  // purchase_date label
  await expect(page.locator('text=/תאריך רכישה/').first()).toBeVisible();
});

test('UI: first charge date hint visible in modal after PM selected', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/policies/list');
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("הוסף פוליסה")').first().click();
  await page.waitForTimeout(500);

  // select a payment method (if any)
  const pmSelect = page.locator('select').filter({ hasText: /אשראי|הו"ק|תשלום/ }).first();
  const pmOptions = pmSelect.locator('option');
  const pmCount = await pmOptions.count();

  if (pmCount > 1) {
    const secondPm = await pmOptions.nth(1).getAttribute('value');
    if (secondPm) {
      await pmSelect.selectOption(secondPm);
      // hint box should mention "חיוב ראשון"
      await expect(page.locator('text=/חיוב ראשון/').first()).toBeVisible();
    }
  } else {
    // hint still shows even without PM (shows "בחר אמצעי תשלום")
    await expect(page.locator('text=/חיוב ראשון/').first()).toBeVisible();
  }
});

test('UI: create standalone policy end-to-end', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/policies/list');
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("הוסף פוליסה")').first().click();
  await page.waitForTimeout(500);

  // ensure ללא רכב is selected (default)
  const vehicleSelect = page.locator('select').filter({ hasText: 'ללא רכב' }).first();
  await vehicleSelect.selectOption('');

  // fill policy_type
  const policyTypeInput = page.locator('input[placeholder*="סוג פוליסה"], input[placeholder*="קבלנים"]').first();
  await policyTypeInput.fill('פוליסת קבלנים E2E');

  // fill policy number
  const policyNumberInput = page.locator('input').filter({ hasText: '' }).nth(1);
  // find by proximity — fill first text input that is not the policy type
  const allInputs = page.locator('input[type="text"], input:not([type])');
  // easier: find label "מספר פוליסה" and fill its sibling input
  const policyNumField = page.locator('.form-group').filter({ hasText: 'מספר פוליסה' }).locator('input').first();
  await policyNumField.fill('E2E-STANDALONE-99');

  // set premium
  const premiumField = page.locator('.form-group').filter({ hasText: 'פרמיה' }).locator('input').first();
  await premiumField.fill('1200');

  // set start_date
  const startField = page.locator('input[type="date"]').first();
  await startField.fill('2026-01-01');

  // submit
  await page.locator('button:has-text("שמור"), button:has-text("הוסף")').first().click();
  await page.waitForTimeout(2000);

  // verify the policy appears in the table with the 🏢 badge
  await expect(page.locator('text=/פוליסת קבלנים E2E/').first()).toBeVisible();
});

// ── UI: payment methods page ──────────────────────────────────────────────────

test('UI: payment methods page shows existing methods', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/payment-methods');
  await page.waitForTimeout(2000);
  // should show at least one payment method name
  await expect(page.locator('text=/ויזה|אשראי|העברה|הו"ק/').first()).toBeVisible();
});

// ── UI: payment schedule page ─────────────────────────────────────────────────

test('UI: payment schedule page renders table or empty state', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/policies/payments');
  await page.waitForTimeout(2000);
  // either a table row or an empty message
  const hasContent = await page.locator('table tr, text=/אין תשלומים|לא נמצאו/').count();
  expect(hasContent).toBeGreaterThan(0);
});

// ── UI: reports ───────────────────────────────────────────────────────────────

test('UI: payment methods report renders', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/reports/payment-methods');
  await page.waitForTimeout(2000);
  await expect(page.locator('h1, h2, h3').first()).toBeVisible();
});
