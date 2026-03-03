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
  // --- ADICIONE O TRECHO ABAIXO ---
  server: {
    proxy: {
      // Cria o túnel para o Supabase ignorar o bloqueio de rede
      '/api/supabase-proxy': {
        target: 'https://dompaukvvwtjuszvpssu.supabase.co',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/supabase-proxy/, ''),
      },
    },
  },
});