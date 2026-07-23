// Sdílecí karta výsledku denní výzvy.
//
// Kreslí se přímo přes Canvas 2D — žádná externí knihovna (CSP stejně blokuje CDN)
// a máme plnou kontrolu nad výsledkem. Záměrně BEZ fotky a názvu události, aby
// sdílený obrázek nespoiloval dnešní výzvu ostatním.

export interface ShareCardData {
  dateLabel: string      // „22. července"
  score: number          // celkové skóre kola
  maxScore: number       // 1000
  locScore: number       // 0–500
  yearScore: number      // 0–500
  distanceLabel: string  // „429 km"
  yearLabel: string      // „±2 roky"
  betterThan?: number | null  // percentil oproti ostatním hráčům
  labels: {
    eyebrow: string      // TENTO DEN V HISTORII
    place: string        // Místo
    year: string         // Rok
    better: string       // „Lepší než 78 % hráčů"
    cta: string          // „Zahraj si taky"
    site: string         // historyguessr.vercel.app
  }
}

const W = 1080
const H = 1350
const ACCENT = '#d97757'
const CREAM = '#F5F1E8'

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

/** Kompas — stejný motiv jako ikona aplikace a loader. */
function compass(c: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  c.save()
  c.translate(cx, cy)
  c.strokeStyle = 'rgba(245,241,232,0.34)'
  c.lineWidth = r * 0.08
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke()
  c.rotate((20 * Math.PI) / 180)
  c.fillStyle = ACCENT
  c.beginPath(); c.moveTo(0, -r * 0.82); c.lineTo(-r * 0.23, 0); c.lineTo(r * 0.23, 0); c.closePath(); c.fill()
  c.fillStyle = 'rgba(245,241,232,0.7)'
  c.beginPath(); c.moveTo(0, r * 0.82); c.lineTo(-r * 0.23, 0); c.lineTo(r * 0.23, 0); c.closePath(); c.fill()
  c.restore()
}

/** Vodorovný ukazatel přesnosti (0–1). */
function meter(c: CanvasRenderingContext2D, x: number, y: number, w: number, pct: number) {
  const h = 12
  c.fillStyle = 'rgba(245,241,232,0.14)'
  roundRect(c, x, y, w, h, h / 2); c.fill()
  const fill = Math.max(0.02, Math.min(1, pct)) * w
  const g = c.createLinearGradient(x, 0, x + fill, 0)
  g.addColorStop(0, '#b85a3e'); g.addColorStop(1, ACCENT)
  c.fillStyle = g
  roundRect(c, x, y, fill, h, h / 2); c.fill()
}

/** Vykreslí text a zmenší ho, dokud se nevejde do dané šířky (dlouhé hodnoty
 *  jako „1 234 let vedle" by jinak přetekly z dlaždice). */
function fitText(c: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, font: string) {
  let s = size
  c.font = `600 ${s}px ${font}`
  while (s > 26 && c.measureText(text).width > maxW) {
    s -= 2
    c.font = `600 ${s}px ${font}`
  }
  c.fillText(text, x, y)
}

/** Vykreslí kartu a vrátí PNG blob (1080×1350, poměr 4:5 pro stories i příspěvky). */
export async function renderDailyShareCard(d: ShareCardData): Promise<Blob> {
  // Bez načtených fontů by se kreslilo fallbackem
  try { await document.fonts.ready } catch { /* ignore */ }

  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const c = canvas.getContext('2d')!

  // Pozadí — sépiový přechod + teplé nasvícení shora
  const bg = c.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#3A2B1D'); bg.addColorStop(0.55, '#241A11'); bg.addColorStop(1, '#14100A')
  c.fillStyle = bg; c.fillRect(0, 0, W, H)
  const glow = c.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, W * 0.75)
  glow.addColorStop(0, 'rgba(217,119,87,0.20)'); glow.addColorStop(1, 'rgba(217,119,87,0)')
  c.fillStyle = glow; c.fillRect(0, 0, W, H)

  c.textAlign = 'center'

  // Hlavička: kompas + wordmark
  compass(c, W / 2, 150, 46)
  c.fillStyle = 'rgba(245,241,232,0.62)'
  c.font = '600 30px "JetBrains Mono", ui-monospace, monospace'
  c.letterSpacing = '10px'
  c.fillText('HISTORYGUESSR', W / 2, 268)
  c.letterSpacing = '0px'

  // Eyebrow + datum
  c.fillStyle = ACCENT
  c.font = '600 26px "JetBrains Mono", ui-monospace, monospace'
  c.letterSpacing = '6px'
  c.fillText(d.labels.eyebrow.toUpperCase(), W / 2, 372)
  c.letterSpacing = '0px'
  c.fillStyle = CREAM
  c.font = '600 52px Fraunces, Georgia, serif'
  c.fillText(d.dateLabel, W / 2, 442)

  // Skóre — dominanta karty
  const scoreTxt = String(d.score).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')  // oddělovač tisíců, jazykově neutrální
  c.fillStyle = ACCENT
  c.font = '600 210px Fraunces, Georgia, serif'
  c.fillText(scoreTxt, W / 2, 690)
  c.fillStyle = 'rgba(245,241,232,0.45)'
  c.font = '500 46px Fraunces, Georgia, serif'
  c.fillText(`/ ${d.maxScore}`, W / 2, 758)

  // Dvě statistiky vedle sebe
  const cardW = 420, cardH = 232, gap = 40
  const left = (W - cardW * 2 - gap) / 2
  const stats: [string, string, number][] = [
    [d.labels.place, d.distanceLabel, d.locScore / 500],
    [d.labels.year, d.yearLabel, d.yearScore / 500],
  ]
  stats.forEach(([label, value, pct], i) => {
    const x = left + i * (cardW + gap)
    const y = 830
    c.fillStyle = 'rgba(245,241,232,0.06)'
    roundRect(c, x, y, cardW, cardH, 28); c.fill()
    c.strokeStyle = 'rgba(245,241,232,0.12)'; c.lineWidth = 2
    roundRect(c, x, y, cardW, cardH, 28); c.stroke()

    c.fillStyle = 'rgba(245,241,232,0.5)'
    c.font = '600 24px "JetBrains Mono", ui-monospace, monospace'
    c.letterSpacing = '5px'
    c.fillText(label.toUpperCase(), x + cardW / 2, y + 58)
    c.letterSpacing = '0px'

    c.fillStyle = CREAM
    fitText(c, value, x + cardW / 2, y + 136, cardW - 60, 64, 'Fraunces, Georgia, serif')

    meter(c, x + 46, y + 172, cardW - 92, pct)
  })

  // Volitelný percentil
  if (d.betterThan != null) {
    c.fillStyle = 'rgba(245,241,232,0.62)'
    c.font = '500 34px Inter, system-ui, sans-serif'
    c.fillText(d.labels.better, W / 2, 1148)
  }

  // Patička
  c.fillStyle = ACCENT
  c.font = '700 34px Inter, system-ui, sans-serif'
  c.fillText(d.labels.cta, W / 2, 1232)
  c.fillStyle = 'rgba(245,241,232,0.42)'
  c.font = '500 28px "JetBrains Mono", ui-monospace, monospace'
  c.fillText(d.labels.site, W / 2, 1284)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob selhal'))), 'image/png')
  })
}
