import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { r2ApiPlugin } from './vite-r2-plugin.js'

export default defineConfig({
  plugins: [react(), r2ApiPlugin()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy for n8n webhooks to bypass CORS
      '/api/webhook-test': {
        target: process.env.VITE_N8N_BASE_URL || 'https://n8n.srv1123126.hstgr.cloud',
        changeOrigin: true,
        rewrite: (path) => {
          // Remove /api/webhook-test prefix and keep the rest
          const newPath = path.replace(/^\/api\/webhook-test/, '/webhook-test');
          console.log('🔄 Proxy rewrite:', path, '→', newPath);
          return newPath;
        },
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('❌ Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('📤 Proxying request:', req.method, req.url, '→', proxyReq.path);
          });
        }
      },
      '/api/webhook': {
        target: process.env.VITE_N8N_BASE_URL || 'https://n8n.srv1123126.hstgr.cloud',
        changeOrigin: true,
        rewrite: (path) => {
          // Remove /api/webhook prefix and keep the rest
          const newPath = path.replace(/^\/api\/webhook/, '/webhook');
          console.log('🔄 Proxy rewrite:', path, '→', newPath);
          return newPath;
        },
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('❌ Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('📤 Proxying request:', req.method, req.url, '→', proxyReq.path);
          });
        }
      }
    }
  }
})
