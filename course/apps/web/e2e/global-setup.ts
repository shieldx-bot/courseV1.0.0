import { request as playwrightRequest, FullConfig } from '@playwright/test';

/**
 * Provisions the E2E test user via the API so the suite can run against a
 * fresh staging database where the CI test user does not exist yet. Signup is
 * idempotent (400 when the account already exists). No browser login here —
 * the setup projects handle authenticated storage state, keeping login calls
 * within the API's rate limit.
 */
async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;

  const email = process.env.TEST_USER_EMAIL || 'test@example.com';
  const password = process.env.TEST_USER_PASSWORD || 'testpassword123';

  const api = await playwrightRequest.newContext({ baseURL });
  await api.post('/api/v1/auth/signup', {
    data: { email, password, name: 'E2E Test User' },
  });
  await api.dispose();
}

export default globalSetup;
