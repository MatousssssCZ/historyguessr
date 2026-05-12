import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { createEvent, uploadPanorama, uploadEventImage } from '@/lib/supabase'
import type { EventInsert } from '@/types/database'

// ── CSV šablona ───────────────────────────────────────────
const CSV_TEMPLATE = `title,description,year,lat,lng,category,difficulty,year_range,location_radius_km,panorama_filename,image_filename
Bitva na Bílé hoře,"Bitva na Bílé hoře proběhla 8. listopadu 1620 u Prahy.",1620,50.0755,14.2836,war,2,0,0,bila_hora_360.jpg,bila_hora.jpg
Výbuch Vesuvu,"Sopka Vesuv vybuchla v roce 79 n. l. a pohřbila město Pompeje.",-79,40.8210,14.4260,science,3,5,10,vesuvius_360.jpg,vesuvius.jpg`

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'historyguessr_import_sablona.csv'
  a.click(); URL.revokeObjectURL(url)
}

async function downloadXLSTemplate() {
  const XLSX = await import('xlsx')
  const headers = ['title','description','year','lat','lng','category','difficulty','year_range','location_radius_km','panorama_filename','image_filename']
  const rows = [
    ['Bitva na Bílé hoře','Bitva na Bílé hoře proběhla 8. listopadu 1620 u Prahy.',1620,50.0755,14.2836,'war',2,0,0,'bila_hora_360.jpg','bila_hora.jpg'],
    ['Výbuch Vesuvu','Sopka Vesuv vybuchla v roce 79 n. l. a pohřbila město Pompeje.',-79,40.8210,14.4260,'science',3,5,10,'vesuvius_360.jpg','vesuvius.jpg'],
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [{wch:30},{wch:50},{wch:8},{wch:10},{wch:10},{wch:12},{wch:10},{wch:12},{wch:20},{wch:25},{wch:20}]
  const helpRows = [
    ['Sloupec','Povinný','Popis','Příklady'],
    ['title','ANO','Název historické události','Bitva na Bílé hoře'],
    ['description','ANO','Popis události','Bitva proběhla...'],
    ['year','ANO','Rok (záporné = př. n. l.)','1620, -79'],
    ['lat','ANO','Zeměpisná šířka (-90 až 90)','50.0755'],
    ['lng','ANO','Zeměpisná délka (-180 až 180)','14.4378'],
    ['category','NE','Kategorie','war, culture, science, politics, religion, exploration'],
    ['difficulty','NE','Obtížnost 1–3 (výchozí: 2)','1, 2, 3'],
    ['year_range','NE','Tolerance roku v letech','0, 5, 10'],
    ['location_radius_km','NE','Tolerance polohy v km','0, 5, 20'],
    ['panorama_filename','NE','Název souboru 360° panoramy','panorama.jpg'],
    ['image_filename','NE','Název doplňkového obrázku','cover.jpg'],
  ]
  const wsHelp = XLSX.utils.aoa_to_sheet(helpRows)
  wsHelp['!cols'] = [{wch:22},{wch:10},{wch:40},{wch:40}]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Události')
  XLSX.utils.book_append_sheet(wb, wsHelp, 'Nápověda')
  XLSX.writeFile(wb, 'historyguessr_import_sablona.xlsx')
}

// ── CSV parser ────────────────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h.trim()] = (values[i] ?? '').trim() })
    return row
  })
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''; let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes }
    else if (line[i] === ',' && !inQuotes) { result.push(current); current = '' }
    else { current += line[i] }
  }
  result.push(current)
  return result
}

// ── Typy ─────────────────────────────────────────────────
interface ImportRow {
  id: string
  title: string
  description: string
  year: number
  lat: number
  lng: number
  category: string
  difficulty: 1 | 2 | 3
  year_range: number
  location_radius_km: number
  panorama_filename: string
  image_filename: string
  panoramaFile: File | null
  imageFile: File | null
  errors: string[]
  status: 'pending' | 'uploading' | 'done' | 'error'
  statusMsg: string
}

function rowFromCSV(raw: Record<string, string>, idx: number): ImportRow {
  const errors: string[] = []
  const year = parseInt(raw.year)
  const lat = parseFloat(raw.lat)
  const lng = parseFloat(raw.lng)
  const difficulty = parseInt(raw.difficulty) as 1 | 2 | 3

  if (!raw.title) errors.push('Chybí název')
  if (!raw.description) errors.push('Chybí popis')
  if (isNaN(year)) errors.push('Neplatný rok')
  if (isNaN(lat) || lat < -90 || lat > 90) errors.push('Neplatná šířka')
  if (isNaN(lng) || lng < -180 || lng > 180) errors.push('Neplatná délka')

  return {
    id: `row-${idx}`,
    title: raw.title ?? '',
    description: raw.description ?? '',
    year: isNaN(year) ? 0 : year,
    lat: isNaN(lat) ? 0 : lat,
    lng: isNaN(lng) ? 0 : lng,
    category: raw.category ?? '',
    difficulty: [1,2,3].includes(difficulty) ? difficulty : 2,
    year_range: parseInt(raw.year_range) || 0,
    location_radius_km: parseInt(raw.location_radius_km) || 0,
    panorama_filename: raw.panorama_filename ?? '',
    image_filename: raw.image_filename ?? '',
    panoramaFile: null,
    imageFile: null,
    errors,
    status: 'pending',
    statusMsg: '',
  }
}

// ── Hlavní komponenta ─────────────────────────────────────
type Step = 'upload' | 'preview' | 'importing' | 'done'

export default function AdminImportPage() {
  const { user, isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('upload')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [doneCount, setDoneCount] = useState(0)
  const csvRef = useRef<HTMLInputElement>(null)

  if (!loading && !isAdmin) { navigate('/menu'); return null }

  // ── Nahrání souboru (CSV nebo XLS/XLSX) ─────────────────
  async function handleFile(file: File) {
    setCsvError(null)
    const name = file.name.toLowerCase()

    if (name.endsWith('.csv')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const parsed = parseCSV(text)
        if (!parsed.length) { setCsvError('CSV je prázdné nebo nemá správné hlavičky.'); return }
        setRows(parsed.map(rowFromCSV))
        setStep('preview')
      }
      reader.readAsText(file, 'UTF-8')
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      try {
        const XLSX = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        if (!data.length) { setCsvError('XLS soubor je prázdný nebo nemá správné sloupce.'); return }
        const parsed = data.map(row => {
          const str: Record<string, string> = {}
          Object.entries(row).forEach(([k, v]) => { str[k.trim()] = String(v ?? '').trim() })
          return str
        })
        setRows(parsed.map(rowFromCSV))
        setStep('preview')
      } catch (e) {
        setCsvError('Nepodařilo se načíst XLS soubor. Ujisti se že jde o platný Excel formát.')
      }
    } else {
      setCsvError('Podporované formáty: .csv, .xlsx, .xls')
    }
  }

  // ── Přiřazení panorama souborů ───────────────────────────
  function handlePanoramaFiles(files: FileList) {
    const fileMap = new Map<string, File>()
    Array.from(files).forEach(f => fileMap.set(f.name, f))

    setRows(prev => prev.map(row => {
      const pano = row.panorama_filename ? fileMap.get(row.panorama_filename) ?? null : null
      const img = row.image_filename ? fileMap.get(row.image_filename) ?? null : null
      return { ...row, panoramaFile: pano ?? row.panoramaFile, imageFile: img ?? row.imageFile }
    }))
  }

  // ── Import ────────────────────────────────────────────────
  async function runImport() {
    if (!user) return
    setStep('importing')
    let done = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row.errors.length > 0) continue

      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'uploading', statusMsg: 'Ukládám...' } : r))

      try {
        // Vytvoř událost nejdřív
        const payload: EventInsert = {
          title: row.title,
          description: row.description,
          year: row.year,
          lat: row.lat,
          lng: row.lng,
          category: row.category || null,
          difficulty: row.difficulty,
          year_range: row.year_range,
          location_radius_km: row.location_radius_km,
          panorama_url: 'pending',
          event_image_url: null,
          published: false,
          created_by: user.id,
        }

        const { data, error } = await createEvent(payload)
        if (error || !data) throw new Error('Nepodařilo se vytvořit událost')

        const eventId = (data as { id: string }).id
        let panoramaUrl = ''
        let imageUrl = null

        // Upload panorama
        if (row.panoramaFile) {
          setRows(prev => prev.map(r => r.id === row.id ? { ...r, statusMsg: 'Nahrávám panorama...' } : r))
          const { url, error: upErr } = await uploadPanorama(row.panoramaFile, eventId)
          if (upErr) throw new Error('Chyba při nahrávání panorama')
          panoramaUrl = url!
        }

        // Upload image
        if (row.imageFile) {
          setRows(prev => prev.map(r => r.id === row.id ? { ...r, statusMsg: 'Nahrávám obrázek...' } : r))
          const { url, error: upErr } = await uploadEventImage(row.imageFile, eventId)
          if (!upErr) imageUrl = url
        }

        // Update s URL soubory
        if (panoramaUrl || imageUrl) {
          const { updateEvent } = await import('@/lib/supabase')
          await updateEvent(eventId, {
            panorama_url: panoramaUrl || 'pending',
            event_image_url: imageUrl,
          })
        }

        done++
        setDoneCount(done)
        setRows(prev => prev.map(r => r.id === row.id ? {
          ...r, status: 'done',
          statusMsg: panoramaUrl ? 'Hotovo ✓' : 'Uloženo (bez panoramy)'
        } : r))

      } catch (err) {
        setRows(prev => prev.map(r => r.id === row.id ? {
          ...r, status: 'error',
          statusMsg: err instanceof Error ? err.message : 'Chyba'
        } : r))
      }

      setImportProgress(Math.round(((i + 1) / rows.length) * 100))
    }

    setStep('done')
  }

  const validRows = rows.filter(r => r.errors.length === 0)
  const invalidRows = rows.filter(r => r.errors.length > 0)
  const withPanorama = rows.filter(r => r.panoramaFile)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/admin')}>← Správa událostí</button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>Hromadný import</h1>
        {step === 'preview' && (
          <span className="badge badge-neutral" style={{ marginLeft: 4 }}>{rows.length} řádků</span>
        )}
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── KROK 1: Upload CSV ── */}
        {step === 'upload' && (
          <>
            <div className="card" style={{ padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>Krok 1 — Nahrát soubor</p>
                  <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: 0 }}>
                    Stáhni šablonu (CSV nebo XLS), vyplň data v Excelu nebo Google Sheets a nahraj zpět.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={downloadTemplate}>↓ CSV</button>
                  <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={downloadXLSTemplate}>↓ XLS</button>
                </div>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onClick={() => csvRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--line-strong)'}`,
                  borderRadius: 12, padding: '40px 24px', textAlign: 'center',
                  cursor: 'pointer', background: dragOver ? 'rgba(217,119,87,0.04)' : 'var(--paper-100)',
                  transition: 'all 160ms',
                }}
              >
                <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}/>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
                <p style={{ fontWeight: 500, fontSize: 15, margin: '0 0 4px' }}>Přetáhni soubor nebo klikni pro výběr</p>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>CSV · XLSX · XLS · maximálně 500 řádků</p>
              </div>

              {csvError && <div className="alert alert-error" style={{ marginTop: 12 }}>{csvError}</div>}
            </div>

            <div className="card" style={{ padding: 24 }}>
              <p className="eyebrow" style={{ marginBottom: 14 }}>Sloupce CSV</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['title *', 'description *', 'year *', 'lat *', 'lng *', 'category', 'difficulty (1–3)', 'year_range', 'location_radius_km', 'panorama_filename', 'image_filename'].map(col => (
                  <span key={col} style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    background: col.includes('*') ? 'rgba(217,119,87,0.1)' : 'var(--paper-200)',
                    color: col.includes('*') ? 'var(--accent-deep)' : 'var(--ink-2)',
                    border: `1px solid ${col.includes('*') ? 'rgba(217,119,87,0.3)' : 'var(--line)'}`,
                  }}>
                    {col}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 12 }}>* = povinné · panorama_filename a image_filename = název souboru (přiřadíš v dalším kroku)</p>
            </div>
          </>
        )}

        {/* ── KROK 2: Náhled + obrázky ── */}
        {step === 'preview' && (
          <>
            {/* Shrnutí */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {[
                { label: 'Celkem řádků', value: rows.length },
                { label: 'Připraveno k importu', value: validRows.length },
                { label: 'Chyby', value: invalidRows.length },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding: '16px 20px' }}>
                  <div className="eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, letterSpacing: '-0.02em', color: s.label === 'Chyby' && s.value > 0 ? '#c0392b' : 'var(--ink)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Upload obrázků */}
            <div className="card" style={{ padding: 24 }}>
              <p className="eyebrow" style={{ marginBottom: 8 }}>Panorama a obrázky (volitelné)</p>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 14 }}>
                Přetáhni soubory — automaticky se spárují dle názvu z CSV. Události bez panoramy se uloží jako nepublikované.
              </p>
              <PanoramaDropZone onFiles={handlePanoramaFiles}/>
              {withPanorama.length > 0 && (
                <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
                  ✓ Spárováno: {withPanorama.length} z {rows.filter(r => r.panorama_filename).length} panoram
                </p>
              )}
            </div>

            {/* Tabulka náhledu */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
                <p className="eyebrow" style={{ margin: 0 }}>Náhled dat</p>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--paper-100)', borderBottom: '1px solid var(--line)' }}>
                      {['Název', 'Rok', 'Souřadnice', 'Kat.', 'Panorama', 'Obrázek', 'Stav'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--ink-3)', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--paper-100)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{row.title || <span style={{ color: 'var(--ink-3)' }}>–</span>}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {row.year < 0 ? `${Math.abs(row.year)} př.` : row.year}
                          {row.year_range > 0 && <span style={{ color: 'var(--ink-3)' }}> ±{row.year_range}</span>}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                          {row.lat.toFixed(2)}, {row.lng.toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--ink-3)' }}>{row.category || '–'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {row.panoramaFile
                            ? <span style={{ fontSize: 11, color: '#1d6b3a', background: 'rgba(39,174,96,0.1)', padding: '2px 8px', borderRadius: 999 }}>✓ {row.panoramaFile.name}</span>
                            : row.panorama_filename
                              ? <span style={{ fontSize: 11, color: '#b85a3e', background: 'rgba(217,119,87,0.1)', padding: '2px 8px', borderRadius: 999 }}>⚠ Čeká</span>
                              : <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>–</span>
                          }
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {row.imageFile
                            ? <span style={{ fontSize: 11, color: '#1d6b3a', background: 'rgba(39,174,96,0.1)', padding: '2px 8px', borderRadius: 999 }}>✓</span>
                            : <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>–</span>
                          }
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {row.errors.length > 0
                            ? <span style={{ fontSize: 11, color: '#c0392b', background: 'rgba(192,57,43,0.08)', padding: '2px 8px', borderRadius: 999 }} title={row.errors.join(', ')}>✗ {row.errors[0]}</span>
                            : <span style={{ fontSize: 11, color: '#1d6b3a', background: 'rgba(39,174,96,0.1)', padding: '2px 8px', borderRadius: 999 }}>✓ OK</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Akce */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setRows([]); setStep('upload') }}>← Zpět</button>
              <button
                className="btn btn-accent"
                disabled={validRows.length === 0}
                onClick={runImport}
              >
                Importovat {validRows.length} událost{validRows.length === 1 ? '' : validRows.length < 5 ? 'i' : 'í'} →
              </button>
            </div>
          </>
        )}

        {/* ── KROK 3: Průběh importu ── */}
        {step === 'importing' && (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 16px' }}/>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 22, margin: '0 0 8px' }}>Importuji události…</p>
            <p style={{ color: 'var(--ink-3)', fontSize: 14, margin: '0 0 24px' }}>{doneCount} z {validRows.length} dokončeno</p>
            <div style={{ height: 6, background: 'var(--line)', borderRadius: 999, overflow: 'hidden', maxWidth: 400, margin: '0 auto' }}>
              <div style={{ height: '100%', width: `${importProgress}%`, background: 'var(--accent)', borderRadius: 999, transition: 'width 300ms' }}/>
            </div>
          </div>
        )}

        {/* ── KROK 4: Hotovo ── */}
        {step === 'done' && (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 26, margin: '0 0 8px' }}>Import dokončen</p>
            <p style={{ color: 'var(--ink-3)', fontSize: 14, margin: '0 0 32px' }}>
              {doneCount} událostí importováno · uloženy jako nepublikované
            </p>
            {rows.some(r => !r.panoramaFile && r.panorama_filename) && (
              <div className="alert alert-info" style={{ maxWidth: 480, margin: '0 auto 24px', textAlign: 'left' }}>
                Některé události čekají na panoramu — přidej ji přes editaci události v admin panelu.
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => { setRows([]); setDoneCount(0); setStep('upload') }}>
                Importovat další
              </button>
              <button className="btn btn-accent" onClick={() => navigate('/admin')}>
                Zpět do správy →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Panorama drop zone ────────────────────────────────────
function PanoramaDropZone({ onFiles }: { onFiles: (f: FileList) => void }) {
  const [dragOver, setDragOver] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files) }}
      onClick={() => ref.current?.click()}
      style={{
        border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--line-strong)'}`,
        borderRadius: 10, padding: 20, textAlign: 'center',
        cursor: 'pointer', background: dragOver ? 'rgba(217,119,87,0.04)' : 'var(--paper-100)',
        transition: 'all 160ms',
      }}
    >
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files?.length) onFiles(e.target.files) }}/>
      <div style={{ fontSize: 24, marginBottom: 6 }}>🖼</div>
      <p style={{ fontSize: 13, fontWeight: 500, margin: '0 0 3px' }}>Přetáhni panorama a obrázky</p>
      <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: 0 }}>JPG/PNG · max 50 MB · pojmenuj dle CSV</p>
    </div>
  )
}
