// Průměrný relativní jas obrázku z blobu (0..1).
// Slouží k volbě barvy textu na pozadí (světlé pozadí → tmavý text a naopak).
export async function luminanceFromBlob(blob: Blob): Promise<number | null> {
  try {
    const bmp = await createImageBitmap(blob)
    const w = 24, h = 24
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { bmp.close?.(); return null }
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    const { data } = ctx.getImageData(0, 0, w, h)
    let sum = 0, n = 0
    for (let i = 0; i < data.length; i += 4) {
      sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
      n++
    }
    return n ? sum / n : null
  } catch {
    return null
  }
}
