import { test as setup, expect, request as playwrightRequest } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

const ONBOARDING = {
  status: 'completed',
  interests: ['programming'],
  level: 'beginner',
  goal: 'E2E testing',
  first_challenge_completed: false,
};

// Unique user-agent so the API's per-IP+UA login rate limit (5/min) is not
// shared with the admin setup.
setup.use({ userAgent: 'ascendly-e2e-user' });

/**
 * Self-provisioning auth: signs up the configured test user on a fresh
 * staging database (idempotent), logs in through the real login form (with a
 * retry for the API's 5/min login rate limit), and waits for the
 * `access_token` cookie before saving the storage state.
 */
setup('authenticate user', async ({ page }) => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const email = process.env.TEST_USER_EMAIL || 'test@example.com';
  const password = process.env.TEST_USER_PASSWORD || 'testpassword123';

  const api = await playwrightRequest.newContext({ baseURL });
  await api.post('/api/v1/auth/signup', {
    data: { email, password, name: 'E2E Test User' },
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
        }, { timeout: 30000, message: 'access_token cookie was not set after login' })
        .toBe(true);
      signedIn = true;
    } catch (err) {
      if (attempt === 2) throw err;
      console.log(`Auth setup login attempt ${attempt + 1} failed, retrying…`);
      await page.waitForTimeout(5000);
    }
  }

  // The API's GET /auth/me does not round-trip the onboarding profile, so the
  // frontend restores it from localStorage. Persist it so authenticated flows
  // are not bounced to /onboarding.
  await page.evaluate((onboarding) => {
    window.localStorage.setItem('ascendly:onboarding', JSON.stringify(onboarding));
  }, ONBOARDING);

  await page.context().storageState({ path: authFile });
});
