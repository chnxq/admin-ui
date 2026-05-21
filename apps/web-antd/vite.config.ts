import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // admin REST API
            target: 'http://localhost:7788',
            ws: true,
          },
          '/docs': {
            changeOrigin: true,
            // admin swagger docs
            target: 'http://localhost:7788',
            ws: true,
          },
        },
      },
    },
  };
});
