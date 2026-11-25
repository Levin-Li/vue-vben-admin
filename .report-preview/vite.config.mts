import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  css: { postcss: fileURLToPath(new URL('../apps/bootstrap-app', import.meta.url)) },
  resolve: { alias: [{ find: /^@levin\/admin-framework$/, replacement: fileURLToPath(new URL('./selector.ts', import.meta.url)) }] },
  server: { host: '127.0.0.1', port: 5189, strictPort: true },
});
