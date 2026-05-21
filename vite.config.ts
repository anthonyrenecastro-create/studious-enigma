import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const atlanteanTarget = env.VITE_ATLANTEAN_PROXY_TARGET || 'http://127.0.0.1:5001';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/atlantean': {
            target: atlanteanTarget,
            changeOrigin: true,
            secure: false,
            configure: (proxy) => {
              proxy.on('error', (err, _req, _res) => {
                console.error(`[vite-proxy] /api/atlantean -> ${atlanteanTarget} failed: ${err.message}`);
              });
            },
          },
        },
        hmr: {
          clientPort: 443
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
