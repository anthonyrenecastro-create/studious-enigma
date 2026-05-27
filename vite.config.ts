import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const atlanteanProxyTarget = env.VITE_ATLANTEAN_PROXY_TARGET || 'http://127.0.0.1:5001';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/atlantean': {
            target: atlanteanProxyTarget,
            changeOrigin: true,
          },
          '/health': {
            target: atlanteanProxyTarget,
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      define: {
        // SECURITY: Do NOT inject API keys into frontend builds
        // All sensitive API calls must go through backend
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
