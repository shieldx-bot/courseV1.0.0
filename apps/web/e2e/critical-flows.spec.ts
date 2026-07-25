import { test, expect } from '@playwright/test';

test.describe('Critical User Flows', () => {
  test.describe.configure({ retries: 2 });

  test('Homepage loads and displays key sections', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=Categories')).toBeVisible();
    await expect(page.locator('text=Pricing')).toBeVisible();
  });

  test('Course catalog page loads', async ({ page }) => {
    await page.goto('/courses', { waitUntil: 'networkidle' });

    await expect(page.locator('h1')).toContainText(/Course|Catalog|Learn/i);
  });
});

test.describe('Authenticated User Flows', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('Course player loads for enrolled user', async ({ page }) => {
    await page.goto('/learn/sample-course/lesson-1', { waitUntil: 'networkidle' });

    await expect(page.locator('video')).toBeVisible({ timeout: 15000 });
  });

  test('User can navigate to profile', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    await expect(page.locator('text=Profile')).toBeVisible();
  });
});

test.describe('API Health Checks', () => {
  test('API health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
  });
});