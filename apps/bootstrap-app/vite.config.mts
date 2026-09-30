import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  // 独立本机联调可指定另一端口；拒绝远端代理以免把浏览器认证信息转发出本机。
  const localBackendTarget =
    process.env.LEVIN_DEV_BACKEND_TARGET ?? 'http://127.0.0.1:8081';
  if (!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(localBackendTarget)) {
    throw new Error('开发代理目标必须是本机 HTTP 地址和显式端口');
  }
  const backendTarget =
    process.env.VITE_NITRO_MOCK === 'true'
      ? 'http://localhost:5320'
      : localBackendTarget;
  const jitiBrowserShim = fileURLToPath(
    new URL(
      '../../packages/business/admin-framework/src/framework-commons/app/shims/jiti-browser.ts',
      import.meta.url,
    ),
  );

  return {
    application: {},
    vite: {
      build: {
        target: 'esnext',
      },
      plugins: [
        {
          enforce: 'pre',
          name: 'browser-jiti-shim',
          resolveId(source) {
            if (
              source === 'jiti' ||
              source.startsWith('jiti/') ||
              source.includes('/jiti/') ||
              source.includes('/jiti@')
            ) {
              return jitiBrowserShim;
            }
          },
        },
      ],
      resolve: {
        alias: {
          jiti: jitiBrowserShim,
        },
      },
      server: {
        proxy: {
          '/.well-known/acme-challenge': {
            changeOrigin: false,
            target: backendTarget,
            ws: true,
          },
          '/admin': {
            changeOrigin: false,
            target: backendTarget,
            ws: true,
          },
          '/api': {
            changeOrigin: false,
            target: backendTarget,
            ws: true,
          },
          '/api-docs': {
            changeOrigin: false,
            target: backendTarget,
            ws: true,
          },
          '/behavior-captcha': {
            changeOrigin: false,
            target: backendTarget,
            ws: true,
          },
          '/com.levin.oak.base': {
            changeOrigin: false,
            target: backendTarget,
            ws: true,
          },
          '/lfs': {
            changeOrigin: false,
            target: backendTarget,
            ws: true,
          },
          '/oauth': {
            changeOrigin: false,
            target: backendTarget,
            ws: true,
          },
          '/swagger': {
            changeOrigin: false,
            target: backendTarget,
            ws: true,
          },
          '/v3/api-docs': {
            changeOrigin: false,
            target: backendTarget,
            ws: true,
          },
        },
      },
    },
  };
});
