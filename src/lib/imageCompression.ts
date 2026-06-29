/**
 * Komprimace panoramat před uploadem.
 * Cíl: WebP, max 4096×2048, target 3 MB + generování náhledů (preview).
 */
import { supabase } from './supabase'

// Cap na 4096×2048 — equirektangulární panorama v této velikosti vypadá
// ostře i na mobilu a drží velikost rozumně nízko (cíl ~3 MB místo 10 MB).
const MAX_WIDTH = 4096
const MAX_HEIGHT = 2048

// Rozměry náhledu (preview) — zobrazí se okamžitě, než dotáhne plná verze
const PREVIEW_WIDTH = 1024
const PREVIEW_HEIGHT = 512

export interface CompressionResult {
  file: File
  originalSize: number
  compressedSize: number
  width: number
  height: number
  savings: number  // procent úspory
}

/**
 * Načte obrázek z File do HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Nepodařilo se načíst obrázek')) }
    img.src = url
  })
}

/**
 * Vypočítá cílové rozměry:
 * - Pokud je obrázek větší než MAX → zmenší zachováním poměru
 * - Pokud je menší než MIN → nechá původní (nezvětšuje)
 */
function calcDimensions(w: number, h: number): { width: number; height: number } {
  // Pokud je větší než maximum → zmenši
  if (w > MAX_WIDTH || h > MAX_HEIGHT) {
    const ratio = Math.min(MAX_WIDTH / w, MAX_HEIGHT / h)
    return { width: Math.round(w * ratio), height: Math.round(h * ratio) }
  }
  // Vrať původní rozměry
  return { width: w, height: h }
}

/**
 * Komprimuje obrázek na Canvas a vrátí jako WebP blob
 */
async function canvasCompress(img: CanvasImageSource, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas není dostupný')
  ctx.drawImage(img, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob selhal')),
      'image/webp',
      quality,
    )
  })
}

/**
 * Hlavní funkce — komprimuje panoramu před uploadem.
 * Postupně snižuje kvalitu dokud není pod cílem nebo neklesne pod minimální kvalitu.
 */
export async function compressPanorama(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<CompressionResult> {
  const originalSize = file.size
  onProgress?.('Načítám obrázek…')

  // Zkontroluj jestli prohlížeč podporuje WebP export
  const testCanvas = document.createElement('canvas')
  testCanvas.width = 1; testCanvas.height = 1
  const supportsWebP = testCanvas.toDataURL('image/webp').startsWith('data:image/webp')

  if (!supportsWebP) {
    // Fallback — vrať originál bez komprimace
    console.warn('[Compression] WebP není podporován, nahrávám originál')
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      width: 0,
      height: 0,
      savings: 0,
    }
  }

  const img = await loadImage(file)
  const { width, height } = calcDimensions(img.naturalWidth, img.naturalHeight)

  onProgress?.(`Komprimuji (${width}×${height})…`)

  // Postupně snižuj kvalitu: 0.85 → 0.75 → 0.65 → 0.55
  const qualities = [0.85, 0.75, 0.65, 0.55]
  const TARGET_SIZE = 3 * 1024 * 1024  // 3 MB cíl

  let bestBlob: Blob | null = null

  for (const quality of qualities) {
    try {
      const blob = await canvasCompress(img, width, height, quality)

      if (!bestBlob) bestBlob = blob  // vždy máme alespoň jednu verzi

      if (blob.size <= TARGET_SIZE) {
        bestBlob = blob
        break  // dosáhli jsme cíle
      }

      bestBlob = blob  // uložíme zatím nejlepší výsledek
    } catch (e) {
      console.warn(`[Compression] Kvalita ${quality} selhala:`, e)
    }
  }

  if (!bestBlob) {
    // Canvas selhal — vrať originál
    console.warn('[Compression] Komprimace selhala, nahrávám originál')
    return { file, originalSize, compressedSize: originalSize, width, height, savings: 0 }
  }

  const compressedSize = bestBlob.size

  // Pokud komprimovaný soubor je VĚTŠÍ než originál, vrať originál
  if (compressedSize >= originalSize) {
    return { file, originalSize, compressedSize: originalSize, width, height, savings: 0 }
  }

  const savings = Math.round((1 - compressedSize / originalSize) * 100)
  const baseName = file.name.replace(/\.[^.]+$/, '')
  const compressedFile = new File([bestBlob], `${baseName}.webp`, { type: 'image/webp' })

  onProgress?.(`Hotovo — úspora ${savings}%`)

  return { file: compressedFile, originalSize, compressedSize, width, height, savings }
}

/**
 * Komprimuje ilustrační (doplňkový) obrázek události před uploadem.
 * Zmenší na max šířku 1600 px a uloží jako WebP (q ~0.72). Když WebP není
 * podporován, vrátí originál beze změny.
 */
export async function compressIllustration(file: File, maxDim = 1600): Promise<File> {
  try {
    const testCanvas = document.createElement('canvas')
    testCanvas.width = 1; testCanvas.height = 1
    if (!testCanvas.toDataURL('image/webp').startsWith('data:image/webp')) return file

    const img = await loadImage(file)
    const w = img.naturalWidth, h = img.naturalHeight
    // Omez DELŠÍ stranu (ne jen šířku) — funguje i pro obrázky na výšku.
    const ratio = Math.min(1, maxDim / Math.max(w, h))
    const width = Math.round(w * ratio), height = Math.round(h * ratio)

    // Kvalitativní žebříček — vyber nejmenší výstup, který je menší než originál.
    let best: Blob | null = null
    for (const q of [0.72, 0.6, 0.5]) {
      const blob = await canvasCompress(img, width, height, q)
      if (!best || blob.size < best.size) best = blob
      if (blob.size < file.size * 0.9) break // dost úspory, dál nezkoušej
    }
    if (!best || best.size >= file.size) return file
    const base = file.name.replace(/\.[^.]+$/, '') || 'ilustrace'
    return new File([best], `${base}.webp`, { type: 'image/webp' })
  } catch (e) {
    console.warn('[Illustration] Komprese selhala, nahrávám originál:', e)
    return file
  }
}

/**
 * Vygeneruje malý náhled (preview) panoramatu — 1024×512 WebP.
 * Pannellum ho zobrazí okamžitě, než dotáhne plnou verzi.
 * Vstup: ideálně už zkomprimovaná plná verze (nebo originál).
 */
export async function generatePreview(file: File): Promise<File | null> {
  try {
    const testCanvas = document.createElement('canvas')
    testCanvas.width = 1; testCanvas.height = 1
    const supportsWebP = testCanvas.toDataURL('image/webp').startsWith('data:image/webp')
    if (!supportsWebP) return null

    const img = await loadImage(file)
    const blob = await canvasCompress(img, PREVIEW_WIDTH, PREVIEW_HEIGHT, 0.6)
    return new File([blob], 'preview.webp', { type: 'image/webp' })
  } catch (e) {
    console.warn('[Preview] Generování náhledu selhalo:', e)
    return null
  }
}

/**
 * Vygeneruje náhled z URL už nahraného panoramatu (pro dávkové přegenerování).
 * Načítá s crossOrigin='anonymous', aby se canvas nezašpinil (Supabase Storage
 * posílá CORS hlavičky). Vrací null, když to nejde (CORS / nepodporovaný WebP).
 */
// Vygeneruje náhled z už staženého blobu (panorama stažené přes Supabase SDK).
// createImageBitmap z lokálního blobu canvas nezašpiní → žádný CORS problém.
export async function generatePreviewFromBlob(blob: Blob): Promise<File | null> {
  try {
    const testCanvas = document.createElement('canvas')
    testCanvas.width = 1; testCanvas.height = 1
    if (!testCanvas.toDataURL('image/webp').startsWith('data:image/webp')) return null

    const bitmap = await createImageBitmap(blob)
    const out = await canvasCompress(bitmap, PREVIEW_WIDTH, PREVIEW_HEIGHT, 0.6)
    bitmap.close?.()
    return new File([out], 'preview.webp', { type: 'image/webp' })
  } catch (e) {
    console.warn('[Preview] Generování z blobu selhalo:', e)
    return null
  }
}

export async function generatePreviewFromUrl(url: string): Promise<File | null> {
  if (!url || url === 'pending') return null
  const testCanvas = document.createElement('canvas')
  testCanvas.width = 1; testCanvas.height = 1
  if (!testCanvas.toDataURL('image/webp').startsWith('data:image/webp')) return null

  // Bajty získej blobově (canvas se pak nezašpiní). Přednostně přes Supabase
  // SDK download() — jde na storage API se správnými CORS hlavičkami, na rozdíl
  // od veřejné CDN URL, kterou CDN často cachuje bez CORS.
  let blob: Blob | null = null
  const m = url.match(/\/object\/public\/panorama\/(.+?)(?:\?|$)/)
  if (m) {
    const path = decodeURIComponent(m[1])
    const { data, error } = await supabase.storage.from('panorama').download(path)
    if (error) throw new Error(`download: ${error.message}`)
    blob = data
  }
  // Fallback: přímý fetch
  if (!blob) {
    const res = await fetch(url, { mode: 'cors', cache: 'reload' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    blob = await res.blob()
  }

  const bitmap = await createImageBitmap(blob)
  const out = await canvasCompress(bitmap, PREVIEW_WIDTH, PREVIEW_HEIGHT, 0.6)
  bitmap.close?.()
  return new File([out], 'preview.webp', { type: 'image/webp' })
}

/**
 * Formátuje velikost souboru na čitelný string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
