import { test, expect } from '@playwright/test';

const COURSE_SLUG = process.env.E2E_COURSE_SLUG || 'excel-for-busy-professionals';
const LESSON_ID = process.env.E2E_LESSON_ID || 'lesson-1';

test.describe('Critical User Flows', () => {
  test.describe.configure({ retries: 2 });

  test('Homepage loads and displays key sections', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('heading', { name: /the community is moving/i })).toBeVisible();
    await expect(page.locator('text=Pricing').first()).toBeVisible();
  });

  test('Course catalog page loads', async ({ page }) => {
    await page.goto('/courses', { waitUntil: 'networkidle' });

    await expect(page.locator('h1')).toContainText(/Course|Catalog|Learn/i);
  });
});

test.describe('Authenticated User Flows', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('User can navigate to dashboard', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /command center/i })).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Authenticated Admin Flows', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('Course player loads for enrolled user', async ({ page }) => {
    await page.goto(`/learn/${COURSE_SLUG}/${LESSON_ID}`, { waitUntil: 'networkidle' });

    if (await page.getByText('This lesson is locked').isVisible().catch(() => false)) {
      test.skip(true, `Lesson ${LESSON_ID} is locked for this user on this environment`);
      return;
    }

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /mark complete|completed/i })).toBeVisible({ timeout: 15000 });
  });
});

test.describe('API Health Checks', () => {
  test('API health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/v1/health');
    expect(response.ok()).toBeTruthy();
  });
});
