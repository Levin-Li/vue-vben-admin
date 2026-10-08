import Vue from '@vitejs/plugin-vue';
import VueJsx from '@vitejs/plugin-vue-jsx';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [Vue(), VueJsx()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      ...configDefaults.exclude,
      '**/e2e/**',
      '**/dist/**',
      // 部署配置协议测试使用 Node 原生 test 运行器，避免 Vitest 改写 import.meta.url。
      'scripts/deploy/*.test.mjs',
      '**/.{idea,git,cache,output,temp}/**',
      '**/node_modules/**',
      '**/{stylelint,eslint}.config.*',
      '.prettierrc.mjs',
    ],
  },
});
