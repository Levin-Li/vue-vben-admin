import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  const backendTarget = 'http://127.0.0.1:8080';
  const jitiBrowserShim = fileURLToPath(
    new URL('src/shims/jiti-browser.ts', import.meta.url),
  );

  return {
    application: {},
    vite: {
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
          '/com.levin.oak.base': {
            changeOrigin: false,
            target: backendTarget,
            ws: true,
          },
          '/com.vma.tk.bcm': {
            changeOrigin: false,
            target: backendTarget,
            ws: true,
          },
          '/lfs': {
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
