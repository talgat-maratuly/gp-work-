import { defineConfig } from 'playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    permissions: ['geolocation', 'camera'],
    geolocation: { latitude: 51.2301, longitude: 51.3701, accuracy: 5 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  },
  projects: [
    { name: 'desktop-chromium', use: { browserName: 'chromium', extraHTTPHeaders: { 'X-Forwarded-For': '10.30.0.10' }, viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-chromium', use: { browserName: 'chromium', extraHTTPHeaders: { 'X-Forwarded-For': '10.30.0.11' }, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    { command: 'node apps/api/dist/main.js', url: 'http://localhost:3002/api/health', reuseExistingServer: !process.env.CI, timeout: 60_000, env: { NODE_ENV: 'test', FRONTEND_URL: 'http://localhost:5173', PORT: '3002', DB_MIGRATE: 'true' } },
    { command: process.env.GP_WEB_PRODUCTION === 'true'
      ? 'npm run preview -w @gp-work/web -- --host localhost --port 5173 --strictPort'
      : 'npm run dev -w @gp-work/web -- --host localhost',
      url: 'http://localhost:5173', reuseExistingServer: !process.env.CI, timeout: 60_000 },
  ],
})
