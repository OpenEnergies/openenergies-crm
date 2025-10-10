// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  // Nada de alias absolutos a /node_modules
  // Para evitar React duplicado, usa dedupe de Vite:
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // IMPORTANTe: NO incluyas aquí react ni react-dom.
    // Si tenías algo así, bórralo:
    // include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime']
  },
})


