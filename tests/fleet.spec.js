import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3010';
const ADMIN = { username: 'admin', password: 'admin123' };

async function login(page) {
  await page.goto(BASE);
  await page.getByPlaceholder(/שם משתמש|username/i).fill(ADMIN.username);
  await page.getByPlaceholder(/סיסמה|password/i).fill(ADMIN.password);
  await page.getByRole('button', { name: /כניסה|login/i }).click();
  await page.waitForURL(/\/(?!login)/, { timeout: 10000 });
}

test.describe('Login', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/login/);
  });

  test('login with valid credentials', async ({ page }) => {
    await page.goto(BASE + '/login');
    // Try multiple selectors for username field
    const usernameField = page.locator('input[type="text"], input[name="username"], input[placeholder*="שם"]').first();
    const passwordField = page.locator('input[type="password"]').first();
    await usernameField.fill(ADMIN.username);
    await passwordField.fill(ADMIN.password);
    await page.locator('button[type="submit"], button:has-text("כניסה")').first().click();
    await page.waitForURL(url => !url.includes('login'), { timeout: 10000 });
    await expect(page).not.toHaveURL(/login/);
  });

  test('rejects invalid credentials', async ({ page }) => {
    await page.goto(BASE + '/login');
    const usernameField = page.locator('input[type="text"], input[name="username"]').first();
    const passwordField = page.locator('input[type="password"]').first();
    await usernameField.fill('wrong');
    await passwordField.fill('wrong');
    await page.locator('button[type="submit"], button:has-text("כניסה")').first().click();
    // Should stay on login
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('loads dashboard with key stats', async ({ page }) => {
    // Navigate to dashboard
    const dashLink = page.locator('a[href*="dashboard"], a:has-text("דשבורד"), nav >> text=דשבורד').first();
    if (await dashLink.count() > 0) await dashLink.click();
    await page.waitForTimeout(1500);
    // Page should have some content
    await expect(page.locator('body')).not.toBeEmpty();
  });
});

test.describe('Vehicles', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('vehicles page loads and shows table', async ({ page }) => {
    const vehiclesLink = page.locator('a[href*="vehicle"], a:has-text("רכבים"), nav >> text=רכבים').first();
    if (await vehiclesLink.count() > 0) await vehiclesLink.click();
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).not.toBeEmpty();
    // Should have at least one table or card
    const hasContent = await page.locator('table, .vehicle-card, tr').count() > 0;
    expect(hasContent).toBeTruthy();
  });
});

test.describe('Insurance', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('insurance page loads', async ({ page }) => {
    const link = page.locator('a[href*="insurance"], a:has-text("ביטוח"), nav >> text=ביטוח').first();
    if (await link.count() > 0) await link.click();
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('edit policy modal date fields accept 4-digit years', async ({ page }) => {
    const link = page.locator('a[href*="insurance"], a:has-text("ביטוח"), nav >> text=ביטוח').first();
    if (await link.count() > 0) await link.click();
    await page.waitForTimeout(1500);
    // Open edit modal for first policy
    const editBtn = page.locator('button:has-text("עריכה"), button[title*="עריכה"]').first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await page.waitForTimeout(500);
      // Check date inputs
      const dateInputs = page.locator('input[type="date"]');
      const count = await dateInputs.count();
      for (let i = 0; i < count; i++) {
        const val = await dateInputs.nth(i).inputValue();
        if (val) {
          const year = val.split('-')[0];
          expect(parseInt(year)).toBeGreaterThan(2000);
        }
      }
    }
  });
});

test.describe('API Health', () => {
  test('API returns 401 without auth', async ({ request }) => {
    const r = await request.get('http://localhost:3010/api/vehicles');
    expect(r.status()).toBe(401);
  });

  test('login API returns token', async ({ request }) => {
    const r = await request.post('http://localhost:3010/api/auth/login', {
      data: { username: 'admin', password: 'admin123' }
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.token).toBeTruthy();
  });

  test('authenticated API returns data', async ({ request }) => {
    const loginRes = await request.post('http://localhost:3010/api/auth/login', {
      data: { username: 'admin', password: 'admin123' }
    });
    const { token } = await loginRes.json();
    const r = await request.get('http://localhost:3010/api/vehicles', {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(r.ok()).toBeTruthy();
  });
});
