import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
  // maplibre-gl vytváří web worker přes `new URL('./worker.mjs', import.meta.url)`.
  // Když je předbundlovaný (esbuild), Vite ten worker chunk NEEMITUJE → na produkci
  // worker URL 404 → SPA fallback vrátí index.html → „non-JS MIME" → mapa se nenačte.
  // Vyřazením z optimizeDeps projde maplibre normálním Rollup buildem a worker se emituje.
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
})
