// maplibre-gl v6 vytváří web worker přes `new URL('./maplibre-gl-worker.mjs', import.meta.url)`.
// import.meta.url je hlavní chunk v /assets/, takže worker URL = /assets/maplibre-gl-worker.mjs.
// Vite ten soubor (ani jeho ./maplibre-gl-shared.mjs) do buildu neemituje (dynamický název),
// proto je sem zkopírujeme ručně, jinak worker na produkci 404 → mapa se nenačte.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'node_modules/maplibre-gl/dist')
const dest = resolve(root, 'dist/assets')
mkdirSync(dest, { recursive: true })

// worker → náš verzovaný název (obchází případnou rozbitou cache pod výchozím jménem;
// musí sedět se setWorkerUrl('/assets/mlworker-v1.mjs') v src/lib/mapTiles.ts).
// shared.mjs si worker importuje relativně (./maplibre-gl-shared.mjs), název měnit nelze.
const copies = [
  ['maplibre-gl-worker.mjs', 'mlworker-v1.mjs'],
  ['maplibre-gl-shared.mjs', 'maplibre-gl-shared.mjs'],
]
let copied = 0
for (const [from, to] of copies) {
  const fromPath = resolve(src, from)
  if (existsSync(fromPath)) { copyFileSync(fromPath, resolve(dest, to)); copied++ }
  else console.warn(`[maplibre] chybí ${from} v node_modules`)
}
console.log(`[maplibre] zkopírováno ${copied}/${copies.length} worker souborů do dist/assets`)
