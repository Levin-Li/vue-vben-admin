import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

const isolatedPort = process.env.REPORT_TEST_BACKEND_PORT;
const isolatedProxy = isolatedPort && /^\d{1,5}$/.test(isolatedPort)
  ? { '/isolated-api': { target: `http://127.0.0.1:${isolatedPort}`, changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/isolated-api/, '') } }
  : undefined;

export default defineConfig({
  plugins: [vue(), {
    name: 'isolated-report-role-fixture',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === '../app/api/rbac-service' && importer?.includes('/resource-permission-dialog.vue'))
        return fileURLToPath(new URL('./role-rbac.ts', import.meta.url));
    },
  }],
  css: { postcss: fileURLToPath(new URL('../apps/bootstrap-app', import.meta.url)) },
  resolve: { alias: [
    { find: /^@report-role-dialog$/, replacement: fileURLToPath(new URL('../packages/business/admin-framework/src/framework-commons/shared/resource-permission-dialog.vue', import.meta.url)) },
    { find: /^pinia$/, replacement: fileURLToPath(new URL('../packages/runtime/node_modules/pinia', import.meta.url)) },
    { find: /^@levin\/admin-framework$/, replacement: fileURLToPath(new URL('./selector.ts', import.meta.url)) },
    { find: /^ant-design-vue(?=\/|$)/, replacement: fileURLToPath(new URL('../packages/business/oak-base-admin/node_modules/ant-design-vue', import.meta.url)) },
  ] },
  server: { host: '127.0.0.1', port: 5190, strictPort: true, proxy: isolatedProxy },
});
