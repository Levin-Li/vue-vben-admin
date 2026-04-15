import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          '/admin': {
            changeOrigin: false,
            target: 'http://host.docker.internal:8080',
            ws: true,
          },
          '/com.levin.oak.base': {
            changeOrigin: false,
            target: 'http://host.docker.internal:8080',
            ws: true,
          },
          '/v3/api-docs': {
            changeOrigin: false,
            target: 'http://host.docker.internal:8080',
            ws: true,
          },
        },
      },
    },
  };
});
