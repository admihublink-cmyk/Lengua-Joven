import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '../tests/e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL || 'https://lengua-joven.vercel.app',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})
