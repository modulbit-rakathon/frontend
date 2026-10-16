import { defineConfig } from '@playwright/test';
import config from './playwright.config.js';

const backend = process.env.PILLGAZE_TEST_BACKEND_URL;
if (!backend || !['127.0.0.1', 'localhost'].includes(new URL(backend).hostname) || !process.env.APP_API_KEY) {
  throw new Error('Run a local backend with MOCK_AI=true, then set PILLGAZE_TEST_BACKEND_URL and APP_API_KEY for this test.');
}

export default defineConfig({
  ...config,
  testMatch: '**/backend.spec.js',
  workers: 1,
  webServer: {
    ...config.webServer,
    env: { APP_API_URL: backend, APP_API_KEY: process.env.APP_API_KEY },
  },
});
