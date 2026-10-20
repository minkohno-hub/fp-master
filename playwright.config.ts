import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/fp-master/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [{
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/fp-master/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  }, {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174/fp-master/tests/fixture.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  }],
});
