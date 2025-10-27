// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Si alguna lib intenta importar el worker desde pdfjs-dist,
      // lo redirigimos a nuestro archivo público estable
      'pdfjs-dist/build/pdf.worker.min.mjs': '/pdf.worker.min.mjs',
    },
  },
  optimizeDeps: {
    // Evitamos que Vite “preempquete” pdfjs-dist y rompa la ruta del worker
    exclude: ['pdfjs-dist'],
  },
  server: {
    proxy: {
      '/api/chat': {
        target: 'https://n8n.openenergiesgroup.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/chat$/, '/webhook/f818530f-f9dc-411b-bdc9-7d89c0103cf5/chat'),
      },
    },
  },
})

