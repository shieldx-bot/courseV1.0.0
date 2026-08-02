import { test as setup, expect, request as playwrightRequest } from '@playwright/test';

const authFile = 'playwright/.auth/admin.json';

const ONBOARDING = {
  status: 'completed',
  interests: ['programming'],
  level: 'beginner',
  goal: 'E2E testing',
  first_challenge_completed: false,
};

// Unique user-agent so the API's per-IP+UA login rate limit (5/min) is not
// shared with the regular user setup.
setup.use({ userAgent: 'ascendly-e2e-admin' });

/**
 * Authenticates an admin user (seeded on every environment: admin@ascendly.io)
 * so lesson/adaptive/mastery flows have full access. Logs in through the real
 * login form (with a retry for the API's 5/min login rate limit), waits for
 * the `access_token` cookie, and persists the onboarding profile to
 * localStorage before saving the storage state.
 */
setup('authenticate admin', async ({ page }) => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const email = process.env.ADMIN_EMAIL || 'admin@ascendly.io';
  const password = process.env.ADMIN_PASSWORD || 'password';

  const api = await playwrightRequest.newContext({ baseURL });
  await api.post('/api/v1/auth/signup', {
    data: { email, password, name: 'E2E Admin' },
  });
  await api.dispose();

  let signedIn = false;
  for (let attempt = 0; attempt < 3 && !signedIn; attempt++) {
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    try {
      await expect
        .poll(async () => {
          const cookies = await page.context().cookies();
          return cookies.some((c) => c.name === 'access_token' && c.value);
        }, { timeout: 30000, message: 'admin access_token cookie was not set after login' })
        .toBe(true);
      signedIn = true;
    } catch (err) {
      if (attempt === 2) throw err;
      console.log(`Admin setup login attempt ${attempt + 1} failed, retrying…`);
      await page.waitForTimeout(5000);
    }
  }

  // Persist the onboarding profile so authenticated flows are not bounced
  // to /onboarding (GET /auth/me does not round-trip the onboarding field).
  await page.evaluate((onboarding) => {
    window.localStorage.setItem('ascendly:onboarding', JSON.stringify(onboarding));
  }, ONBOARDING);

  await page.context().storageState({ path: authFile });
});
