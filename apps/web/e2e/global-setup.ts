import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${baseURL}/auth/signin`, { waitUntil: 'networkidle' });

    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'testpassword123');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/learn|\/dashboard|\//, { timeout: 30000 });
    await page.context().storageState({ path: 'playwright/.auth/user.json' });
  } catch (error) {
    console.warn('Auth setup failed, tests will run unauthenticated:', error);
  } finally {
    await browser.close();
  }
}

export default globalSetup;