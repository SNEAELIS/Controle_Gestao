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
});