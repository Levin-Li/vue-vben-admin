import { join } from 'node:path';
import process from 'node:process';

import { defineConfig } from '@playwright/test';

// 复用已启动的专用环境；原始 trace 会包含 Authorization，因此只收集脱敏 JSON。
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'enterprise-inapp.spec.ts',
  globalSetup: './tests/e2e/support/enterprise-inapp-global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  globalTimeout: 900_000,
  expect: { timeout: 15_000 },
  reporter: [['./tests/e2e/support/enterprise-inapp-safe-reporter.ts']],
  outputDir: join(
    process.env.ENTERPRISE_EVIDENCE_DIR || '/tmp/enterprise-inapp-browser',
    'playwright-results',
  ),
  use: {
    browserName: 'chromium',
    channel: process.env.ENTERPRISE_INTERACTION_BROWSER_CHANNEL || undefined,
    headless: true,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
});
