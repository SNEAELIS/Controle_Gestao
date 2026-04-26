import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  resolve: {
    alias: {
      'jspdf': 'jspdf/dist/jspdf.umd.min.js',
    },
  },
  optimizeDeps: {
    include: ['jspdf', 'jspdf-autotable'],
  },
  server: {
    proxy: {
      // Proxy para Autenticação Microsoft (OAuth2)
      '/ms-login': {
        target: 'https://login.microsoftonline.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/ms-login/, ''),
      },
      // Proxy para Microsoft Graph API (Arquivos/SharePoint)
      '/ms-graph': {
        target: 'https://graph.microsoft.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/ms-graph/, ''),
      },
    },
  },
});