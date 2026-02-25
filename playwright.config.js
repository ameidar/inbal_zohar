import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3010',
    headless: true,
    locale: 'he-IL',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
