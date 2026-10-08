import { defineConfig } from '@playwright/test';

// 复用现有本地前端，仅验证显示；不依赖已清理的企业认证全栈夹具。
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'platform-name.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 30_000,
  outputDir: '/tmp/enterprise-platform-name-browser',
  use: { channel: 'chrome', headless: true, trace: 'off', video: 'off' },
});
