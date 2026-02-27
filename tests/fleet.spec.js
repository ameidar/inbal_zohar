import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3010';

async function login(page, user = 'admin', pass = 'admin123') {
  await page.goto(BASE + '/login');
  await page.locator('input[type="text"], input[name="username"]').first().fill(user);
  await page.locator('input[type="password"]').first().fill(pass);
  await page.locator('button[type="submit"], button:has-text("כניסה")').first().click();
  await page.waitForURL(url => !url.includes('login'), { timeout: 10000 });
}

// 1. Auth
test('redirect to login when unauthenticated', async ({ page }) => {
  await page.goto(BASE);
  await expect(page).toHaveURL(/login/);
});

test('login admin', async ({ page }) => {
  await login(page);
  await expect(page).not.toHaveURL(/login/);
});

test('reject bad credentials', async ({ page }) => {
  await page.goto(BASE + '/login');
  await page.locator('input[type="text"]').first().fill('bad');
  await page.locator('input[type="password"]').first().fill('bad');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2000);
  await expect(page).toHaveURL(/login/);
});

// 2. Navigation
test('/ redirects to vehicles dashboard', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/dept\/vehicles/);
});

test('sidebar has department sections', async ({ page }) => {
  await login(page);
  const sidebar = page.locator('nav, aside, [class*="sidebar"]').first();
  await expect(sidebar).toBeVisible();
});

// 3. Vehicles
test('vehicles list loads', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/list');
  await page.waitForTimeout(1500);
  const rows = page.locator('table tr, [class*="vehicle"]');
  await expect(rows.first()).toBeVisible();
});

// 4. Policies / Insurance
test('policies list loads', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/policies/list');
  await page.waitForTimeout(1500);
  await expect(page.locator('body')).not.toBeEmpty();
});

// 5. Payment Methods
test('payment methods page loads', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/payment-methods');
  await page.waitForTimeout(1500);
  await expect(page.locator('body')).not.toBeEmpty();
});

// 6. Documents
test('documents center loads', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/documents');
  await page.waitForTimeout(1500);
  await expect(page.locator('body')).not.toBeEmpty();
});

// 7. Duplicates
test('duplicates page loads', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/duplicates');
  await page.waitForTimeout(1500);
  await expect(page.locator('body')).not.toBeEmpty();
});

// 8. Tool Categories
test('tool categories page loads', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/tools/categories');
  await page.waitForTimeout(1500);
  await expect(page.locator('body')).not.toBeEmpty();
});

// 9. Dashboard drill-down
test('dashboard KPIs are clickable', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/dashboard');
  await page.waitForTimeout(1500);
  const kpis = page.locator('[class*="kpi"], [class*="card"], [class*="stat"]');
  // At least some clickable cards exist
  const count = await kpis.count();
  expect(count).toBeGreaterThan(0);
});

// 10. Mobile responsive
test('hamburger visible on narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await login(page);
  const hamburger = page.locator('.hamburger-btn, [class*="hamburger"], button[aria-label="תפריט"]');
  await expect(hamburger).toBeVisible();
});

// 11. API Health
test('API: auth returns token', async ({ request }) => {
  const r = await request.post(BASE + '/api/auth/login', { data: { username: 'admin', password: 'admin123' } });
  expect(r.ok()).toBeTruthy();
  const { token } = await r.json();
  expect(token).toBeTruthy();
});

test('API: payment-methods endpoint exists', async ({ request }) => {
  const loginRes = await request.post(BASE + '/api/auth/login', { data: { username: 'admin', password: 'admin123' } });
  const { token } = await loginRes.json();
  const r = await request.get(BASE + '/api/payment-methods', { headers: { Authorization: `Bearer ${token}` } });
  expect(r.ok()).toBeTruthy();
});

test('API: documents endpoint exists', async ({ request }) => {
  const loginRes = await request.post(BASE + '/api/auth/login', { data: { username: 'admin', password: 'admin123' } });
  const { token } = await loginRes.json();
  const r = await request.get(BASE + '/api/documents', { headers: { Authorization: `Bearer ${token}` } });
  expect(r.ok()).toBeTruthy();
});

test('API: tool-categories endpoint exists', async ({ request }) => {
  const loginRes = await request.post(BASE + '/api/auth/login', { data: { username: 'admin', password: 'admin123' } });
  const { token } = await loginRes.json();
  const r = await request.get(BASE + '/api/tool-categories', { headers: { Authorization: `Bearer ${token}` } });
  expect(r.ok()).toBeTruthy();
});

test('API: duplicates vehicles endpoint', async ({ request }) => {
  const loginRes = await request.post(BASE + '/api/auth/login', { data: { username: 'admin', password: 'admin123' } });
  const { token } = await loginRes.json();
  const r = await request.get(BASE + '/api/duplicates/vehicles', { headers: { Authorization: `Bearer ${token}` } });
  expect(r.ok()).toBeTruthy();
});

test('API: payment-schedule endpoint', async ({ request }) => {
  const loginRes = await request.post(BASE + '/api/auth/login', { data: { username: 'admin', password: 'admin123' } });
  const { token } = await loginRes.json();
  const r = await request.get(BASE + '/api/payment-schedule', { headers: { Authorization: `Bearer ${token}` } });
  expect(r.ok()).toBeTruthy();
});

test('API: operator-license endpoint', async ({ request }) => {
  const loginRes = await request.post(BASE + '/api/auth/login', { data: { username: 'admin', password: 'admin123' } });
  const { token } = await loginRes.json();
  const r = await request.get(BASE + '/api/operator-license', { headers: { Authorization: `Bearer ${token}` } });
  expect(r.ok()).toBeTruthy();
});

// 12. Payment Schedule page
test('payment schedule page loads', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/policies/payments');
  await page.waitForTimeout(1500);
  await expect(page.locator('body')).not.toBeEmpty();
});

// 13. Vehicles dashboard
test('vehicles dashboard loads', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/dashboard');
  await page.waitForTimeout(1500);
  await expect(page.locator('h2')).toBeVisible();
});

// 14. Operator license
test('operator license page loads', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/operator-license');
  await page.waitForTimeout(1500);
  await expect(page.locator('body')).not.toBeEmpty();
});

// 15. Payment Methods Report
test('payment methods report loads', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/dept/vehicles/reports/payment-methods');
  await page.waitForTimeout(1500);
  await expect(page.locator('body')).not.toBeEmpty();
});
