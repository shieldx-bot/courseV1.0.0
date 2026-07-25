import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate user', async ({ page }) => {
  const { baseURL } = page.context().browser()?.defaultContext?.options || { baseURL: 'http://localhost:3000' };

  await page.goto(`${baseURL}/auth/signin`, { waitUntil: 'networkidle' });

  await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
  await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'testpassword123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/learn|\/dashboard|\//, { timeout: 30000 });

  await page.context().storageState({ path: authFile });
});