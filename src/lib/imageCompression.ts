/**
 * Komprimace panoramat před uploadem.
 * Cíl: WebP, max 8192×4096, min 4096×2048, target 3–6 MB
 */

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
async function canvasCompress(img: HTMLImageElement, width: number, height: number, quality: number): Promise<Blob> {
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
 * Formátuje velikost souboru na čitelný string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
