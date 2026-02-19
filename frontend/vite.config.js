import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: (proxy) => {
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
