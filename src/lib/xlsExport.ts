// Export do XLSX přes SheetJS načtený z unpkg (stejná konvence jako import, CSP to povoluje).
type XLSXLib = {
  utils: {
    book_new(): unknown
    aoa_to_sheet(rows: (string | number)[][]): unknown
    book_append_sheet(wb: unknown, ws: unknown, name: string): void
  }
  writeFile(wb: unknown, filename: string): void
}

let xlsxPromise: Promise<XLSXLib | null> | null = null
function loadXLSX(): Promise<XLSXLib | null> {
  const w = window as unknown as { XLSX?: XLSXLib }
  if (w.XLSX) return Promise.resolve(w.XLSX)
  if (!xlsxPromise) {
    xlsxPromise = new Promise(resolve => {
      const s = document.createElement('script')
      s.src = 'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
      s.onload = () => resolve((window as unknown as { XLSX?: XLSXLib }).XLSX ?? null)
      s.onerror = () => resolve(null)
      document.head.appendChild(s)
    })
  }
  return xlsxPromise
}

/** Vytvoří a stáhne XLSX z pole řádků (první řádek = hlavička). Vrací false, když se SheetJS nenačte. */
export async function exportXLS(filename: string, sheetName: string, rows: (string | number)[][]): Promise<boolean> {
  const XLSX = await loadXLSX()
  if (!XLSX) return false
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, filename)
  return true
}
