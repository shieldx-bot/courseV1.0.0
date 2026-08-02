import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  use: {
    baseURL: externalBaseURL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'admin-setup',
      testMatch: /admin\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup', 'admin-setup'],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup', 'admin-setup'],
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
      dependencies: ['setup', 'admin-setup'],
    },
    {
      name: 'chromium-unauthenticated',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(externalBaseURL
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
      }),
  expect: {
    toHaveScreenshot: { maxDiffPixels: 100 },
  },
});