import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const auth = req.headers.authorization;
            if (auth) proxyReq.setHeader('Authorization', auth);
          });
          proxy.on('error', (err, req, res) => {
            if (!res.headersSent) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 503;
              res.end(JSON.stringify({
                error: 'Backend no disponible. Ejecutá en otra terminal: npm run dev:backend',
              }));
            }
          });
        },
      },
    },
  },
});
