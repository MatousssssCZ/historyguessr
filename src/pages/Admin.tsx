// ── CSV šablona ke stažení ───────────────────────────────
function downloadCSVTemplate() {
  const csv = [
    'title,description,year,lat,lng,category,difficulty,year_range,location_radius_km,panorama_filename,image_filename',
    '"Bitva na Bílé hoře","Bitva na Bílé hoře proběhla 8. listopadu 1620 u Prahy.",1620,50.0755,14.2836,war,2,0,0,bila_hora_360.jpg,bila_hora.jpg',
    '"Výbuch Vesuvu","Sopka Vesuv vybuchla v roce 79 n. l. a pohřbila město Pompeje.",-79,40.8210,14.4260,science,3,5,10,vesuvius_360.jpg,vesuvius.jpg',
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'historyguessr_import_sablona.csv'
  a.click(); URL.revokeObjectURL(url)
}

async function downloadXLSTemplate() {
  if (!(window as any).XLSX) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
      s.onload = () => resolve(); s.onerror = reject
      document.head.appendChild(s)
    })
  }
  const XLSX = (window as any).XLSX

  const headers = ['title', 'description', 'year', 'lat', 'lng', 'category', 'difficulty', 'year_range', 'location_radius_km', 'panorama_filename', 'image_filename']

  const exampleRows = [
    ['Bitva na Bílé hoře', 'Bitva na Bílé hoře proběhla 8. listopadu 1620 u Prahy.', 1620, 50.0755, 14.2836, 'war', 2, 0, 0, 'bila_hora_360.jpg', 'bila_hora.jpg'],
    ['Výbuch Vesuvu', 'Sopka Vesuv vybuchla v roce 79 n. l. a pohřbila město Pompeje.', -79, 40.8210, 14.4260, 'science', 3, 5, 10, 'vesuvius_360.jpg', 'vesuvius.jpg'],
  ]

  const wsData = [headers, ...exampleRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Šířky sloupců
  ws['!cols'] = [
    { wch: 30 }, { wch: 50 }, { wch: 8 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 25 }, { wch: 20 },
  ]

  // Styl hlavičky (tučně)
  headers.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i })
    if (!ws[cell]) return
    ws[cell].s = { font: { bold: true }, fill: { fgColor: { rgb: 'F5F1E8' } } }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Události')

  // Druhý list s nápovědou
  const helpData = [
    ['Sloupec', 'Povinný', 'Popis', 'Příklady hodnot'],
    ['title', 'ANO', 'Název historické události', 'Bitva na Bílé hoře'],
    ['description', 'ANO', 'Popis události (zobrazí se hráčovi po odeslání tipu)', 'Bitva proběhla...'],
    ['year', 'ANO', 'Rok události (záporné = př. n. l.)', '1620, -79, 1912'],
    ['lat', 'ANO', 'Zeměpisná šířka (-90 až 90)', '50.0755'],
    ['lng', 'ANO', 'Zeměpisná délka (-180 až 180)', '14.4378'],
    ['category', 'NE', 'Kategorie události', 'war, culture, science, politics, religion, exploration'],
    ['difficulty', 'NE', 'Obtížnost 1–3 (výchozí: 2)', '1, 2, 3'],
    ['year_range', 'NE', 'Tolerance roku v letech (výchozí: 0)', '0, 5, 10, 50'],
    ['location_radius_km', 'NE', 'Tolerance polohy v km (výchozí: 0)', '0, 5, 20'],
    ['panorama_filename', 'NE', 'Název souboru 360° panoramy', 'bila_hora_360.jpg'],
    ['image_filename', 'NE', 'Název doplňkového obrázku', 'bila_hora.jpg'],
  ]
  const wsHelp = XLSX.utils.aoa_to_sheet(helpData)
  wsHelp['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 50 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsHelp, 'Nápověda')

  XLSX.writeFile(wb, 'historyguessr_import_sablona.xlsx')
}

import { useEffect, useState, useRef, forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { compressPanorama, generatePreview, generatePreviewFromBlob, formatFileSize } from '@/lib/imageCompression'
import { getAdminEvents, createEvent, updateEvent, deleteEvent, togglePublished, uploadPanorama, uploadEventImage, uploadPanoramaWithCleanup, uploadPanoramaPreview, downloadPanoramaBlob, track } from '@/lib/supabase'
import { formatYear } from '@/lib/scoring'
import { generateEventDraft } from '@/lib/ai'
import type { Event } from '@/types/database'
import AdminMap from '@/components/AdminMap'

type Panel = 'list' | 'new' | 'edit'

export default function AdminPage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [panel, setPanel] = useState<Panel>('list')
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [fetching, setFetching] = useState(true)
  const [regen, setRegen] = useState<{ running: boolean; done: number; total: number; failed: number; firstError?: string } | null>(null)

  useEffect(() => {
    if (!loading && !isAdmin) navigate('/menu')
  }, [isAdmin, loading])

  useEffect(() => { loadEvents() }, [])

  async function loadEvents() {
    setFetching(true)
    const { data } = await getAdminEvents()
    setEvents((data ?? []).slice().sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)))
    setFetching(false)
  }

  async function handleToggle(id: string, published: boolean) {
    await togglePublished(id, !published)
    loadEvents()
  }

  async function handleDelete(id: string) {
    if (!confirm('Opravdu smazat tuto událost?')) return
    await deleteEvent(id)
    loadEvents()
  }

  // Dávkové přegenerování náhledů (preview) ze stávajících panoramat.
  // Volitelně jen chybějící (onlyMissing), jinak všechny.
  async function handleRegeneratePreviews(onlyMissing = false) {
    const targets = events.filter(e =>
      e.panorama_url && e.panorama_url !== 'pending' && (!onlyMissing || !e.preview_url)
    )
    if (targets.length === 0) { alert('Není co přegenerovat.'); return }
    if (!confirm(`Přegenerovat náhledy pro ${targets.length} událostí?\nStáhne to každé panorama (velké soubory) — nech tuto kartu otevřenou až do konce.`)) return

    setRegen({ running: true, done: 0, total: targets.length, failed: 0 })
    let done = 0, failed = 0
    let firstError = ''
    for (const ev of targets) {
      try {
        const blob = await downloadPanoramaBlob(ev.panorama_url)
        const preview = blob ? await generatePreviewFromBlob(blob) : null
        if (!blob) { failed++; firstError ||= 'Panorama se nepodařilo stáhnout (cesta / oprávnění bucketu).' }
        else if (!preview) { failed++; firstError ||= 'Náhled se nepodařilo vykreslit (WebP/canvas).' }
        else {
          const { url, error: upErr } = await uploadPanoramaPreview(preview, ev.id)
          if (upErr || !url) { failed++; firstError ||= `Upload náhledu: ${upErr?.message ?? 'neznámá chyba'}` }
          else {
            const { error: dbErr } = await updateEvent(ev.id, { preview_url: url })
            if (dbErr) { failed++; firstError ||= `Uložení do DB: ${dbErr.message}` }
          }
        }
      } catch (e) { failed++; firstError ||= e instanceof Error ? e.message : String(e) }
      done++
      setRegen({ running: true, done, total: targets.length, failed, firstError })
    }
    setRegen({ running: false, done, total: targets.length, failed, firstError })
    await loadEvents()
  }

  function openEdit(event: Event) {
    setEditingEvent(event)
    setPanel('edit')
  }

  function closePanel() {
    setPanel('list')
    setEditingEvent(null)
    loadEvents()
  }

  if (loading || fetching) return <AdminLoading />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/admin')}>← Admin</button>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>Správa událostí</h1>
          <span className="badge badge-neutral">{events.length} událostí</span>
        </div>
        {panel === 'list' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 13 }} disabled={regen?.running} onClick={() => handleRegeneratePreviews(false)} title="Vytvoří malý náhled z každého panoramatu pro okamžité zobrazení ve hře">
              {regen?.running ? `♻ ${regen.done}/${regen.total}…` : '♻ Přegenerovat náhledy'}
            </button>
            <button className="btn btn-accent" onClick={() => setPanel('new')}>+ Nová událost</button>
          </div>
        )}
        {panel !== 'list' && (
          <button className="btn btn-ghost" onClick={closePanel}>← Zpět na seznam</button>
        )}
      </header>

      {regen && (
        <div style={{ background: regen.running ? 'var(--accent)' : 'var(--success-deep, #1d6b3a)', color: '#fff', padding: '10px 32px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            {regen.running
              ? `♻ Generuji náhledy… ${regen.done} / ${regen.total}${regen.failed ? ` (chyb: ${regen.failed})` : ''}`
              : `✓ Hotovo — ${regen.done - regen.failed} náhledů vytvořeno${regen.failed ? `, ${regen.failed} se nezdařilo` : ''}`}
            {!regen.running && regen.failed > 0 && regen.firstError && (
              <span style={{ display: 'block', fontSize: 12, opacity: 0.85, marginTop: 4 }}>Důvod: {regen.firstError}</span>
            )}
          </span>
          {!regen.running && <button className="btn btn-ghost" style={{ fontSize: 12, color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} onClick={() => setRegen(null)}>Zavřít</button>}
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        {panel === 'list' && (
          <EventList events={events} onEdit={openEdit} onToggle={handleToggle} onDelete={handleDelete} />
        )}
        {panel === 'new' && <EventForm onDone={closePanel} />}
        {panel === 'edit' && editingEvent && <EventForm event={editingEvent} onDone={closePanel} />}
      </div>
    </div>
  )
}

// ── Event list ────────────────────────────────────────────
function EventList({ events, onEdit, onToggle, onDelete }: {
  events: Event[]
  onEdit: (e: Event) => void
  onToggle: (id: string, published: boolean) => void
  onDelete: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Unikátní kategorie z událostí
  const categories = Array.from(new Set(events.map(e => e.category).filter(Boolean))) as string[]

  const filtered = events.filter(ev => {
    const matchSearch = !search || ev.title.toLowerCase().includes(search.toLowerCase())
    const matchCategory = !categoryFilter || ev.category === categoryFilter
    const matchStatus = !statusFilter || (statusFilter === 'published' ? ev.published : !ev.published)
    return matchSearch && matchCategory && matchStatus
  })

  if (events.length === 0) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: 'var(--ink-3)', marginBottom: 16 }}>Žádné události. Začni přidáním první.</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Filtry */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: 'var(--paper-100)' }}>
        <input
          className="input"
          placeholder="Hledat název…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 200, padding: '7px 12px', fontSize: 13 }}
        />
        <select
          className="input"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{ width: 160, padding: '7px 12px', fontSize: 13 }}
        >
          <option value="">Všechny kategorie</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="input"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ width: 140, padding: '7px 12px', fontSize: 13 }}
        >
          <option value="">Všechny stavy</option>
          <option value="published">Publikované</option>
          <option value="draft">Drafty</option>
        </select>
        {(search || categoryFilter || statusFilter) && (
          <button
            className="btn btn-ghost"
            style={{ padding: '7px 12px', fontSize: 13 }}
            onClick={() => { setSearch(''); setCategoryFilter(''); setStatusFilter('') }}
          >
            ✕ Zrušit filtry
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
          {filtered.length} / {events.length}
        </span>
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
          Žádné události neodpovídají filtru.
        </div>
      )}

      {filtered.length > 0 && (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--paper-100)', borderBottom: '1px solid var(--line)' }}>
            {['ID', 'Název', 'Rok', 'Radius', 'Obtížnost', 'Hodnocení', 'Ø skóre', 'Stav', 'Akce'].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--ink-3)', fontWeight: 500 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((ev, i) => (
            <tr key={ev.id} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--paper-100)' }}>
              <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)' }}>
                {ev.seq != null ? `#${ev.seq}` : '—'}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>{ev.title}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{ev.category ?? '—'}</div>
              </td>
              <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {(ev.year_from ?? ev.year) < 0 ? `${Math.abs(ev.year_from ?? ev.year)} př.` : (ev.year_from ?? ev.year)}
                {ev.year_from !== ev.year_to && ev.year_to && (
                  <span style={{ color: 'var(--ink-3)' }}>
                    {' '}— {ev.year_to < 0 ? `${Math.abs(ev.year_to)} př.` : ev.year_to}
                  </span>
                )}
              </td>
              <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {ev.location_radius_km > 0 ? `${ev.location_radius_km} km` : '—'}
              </td>
              <td style={{ padding: '12px 16px' }}>{'★'.repeat(ev.difficulty)}{'☆'.repeat(3 - ev.difficulty)}</td>
              <td style={{ padding: '12px 16px' }}>
                {ev.rating_count > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#d97757', fontSize: 14 }}>{'★'.repeat(Math.round(ev.rating_sum / ev.rating_count))}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                      {(ev.rating_sum / ev.rating_count).toFixed(1)} ({ev.rating_count}×)
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>–</span>
                )}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <EventScoreStat ev={ev}/>
              </td>
              <td style={{ padding: '12px 16px' }}>
                <span className={`badge ${ev.published ? 'badge-success' : 'badge-neutral'}`}>
                  {ev.published ? 'Publikováno' : 'Skrytá'}
                </span>
              </td>
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => onEdit(ev)}>Editovat</button>
                  <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => onToggle(ev.id, ev.published)}>
                    {ev.published ? 'Skrýt' : 'Publikovat'}
                  </button>
                  <button className="btn btn-danger" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => onDelete(ev.id)}>Smazat</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  )
}

// ── Admin mapa s kružnicí ─────────────────────────────────


// ── Event form ────────────────────────────────────────────
type FormData = {
  title: string; description: string
  title_en: string; description_en: string
  title_de: string; description_de: string
  year_from: string; year_to: string; event_date: string
  lat: string; lng: string
  location_radius_km: string
  category: string; difficulty: string; published: boolean
}

function EventForm({ event, onDone }: { event?: Event; onDone: () => void }) {
  const { user } = useAuth()
  const [form, setForm] = useState<FormData>({
    title: event?.title ?? '',
    description: event?.description ?? '',
    title_en: event?.title_en ?? '',
    description_en: event?.description_en ?? '',
    title_de: event?.title_de ?? '',
    description_de: event?.description_de ?? '',
    year_from: String(event?.year_from ?? event?.year ?? 1900),
    year_to: String(event?.year_to ?? event?.year ?? 1900),
    event_date: event?.event_date ?? '',
    lat: String(event?.lat ?? 50.0755),
    lng: String(event?.lng ?? 14.4378),
    location_radius_km: String(event?.location_radius_km ?? 0),
    category: event?.category ?? '',
    difficulty: String(event?.difficulty ?? 2),
    published: event?.published ?? false,
  })
  const [panoramaFile, setPanoramaFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [panoramaPreview, setPanoramaPreview] = useState<string | null>(null)
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)
  const panoramaRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)

  // ── AI předvyplnění ──
  const [aiTitle, setAiTitle] = useState('')
  const [aiYear, setAiYear] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiNote, setAiNote] = useState<string | null>(null)

  async function handleAiGenerate() {
    if (!aiTitle.trim()) { setAiError('Zadej název události.'); return }
    setAiError(null); setAiNote(null); setAiLoading(true)
    try {
      const d = await generateEventDraft(aiTitle.trim(), aiYear.trim())
      setForm(f => ({
        ...f,
        title: d.title_cs ?? aiTitle.trim(),
        title_en: d.title_en ?? f.title_en,
        title_de: d.title_de ?? f.title_de,
        description: d.description_cs ?? f.description,
        description_en: d.description_en ?? f.description_en,
        description_de: d.description_de ?? f.description_de,
        event_date: d.event_date ?? f.event_date,
        year_from: d.year_from != null ? String(d.year_from) : f.year_from,
        year_to: d.year_to != null ? String(d.year_to) : f.year_to,
        lat: d.lat != null ? d.lat.toFixed(6) : f.lat,
        lng: d.lng != null ? d.lng.toFixed(6) : f.lng,
        category: d.category ?? f.category,
      }))
      setAiNote(d.note || 'Pole předvyplněna. Zkontroluj prosím vše (hlavně GPS na mapě) před uložením.')
    } catch (e: any) {
      setAiError(e?.message || 'Generování selhalo.')
    } finally {
      setAiLoading(false)
    }
  }

  function set(key: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))
  }

  function handleMapClick(lat: number, lng: number) {
    setForm(f => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null); setSaving(true)

    try {
      const yearFrom = parseInt(form.year_from) || 1900
      const yearTo = parseInt(form.year_to) || 1900
      if (yearFrom > yearTo) { setError('Rok od musí být ≤ roku do.'); setSaving(false); return }
      const yearMid = Math.round((yearFrom + yearTo) / 2)
      const payload = {
        title: form.title,
        description: form.description,
        title_en: form.title_en.trim() || null,
        description_en: form.description_en.trim() || null,
        title_de: form.title_de.trim() || null,
        description_de: form.description_de.trim() || null,
        year: yearMid,
        year_from: yearFrom,
        year_to: yearTo,
        year_range: Math.round((yearTo - yearFrom) / 2),
        event_date: form.event_date.trim() || null,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        location_radius_km: parseInt(form.location_radius_km) || 0,
        category: form.category || null,
        difficulty: parseInt(form.difficulty) as 1 | 2 | 3,
        published: form.published,
        panorama_url: event?.panorama_url ?? '',
        event_image_url: event?.event_image_url ?? null,
        created_by: user.id,
      }

      let savedId = event?.id

      if (event) {
        const { error } = await updateEvent(event.id, payload)
        if (error) throw error
      } else {
        const { data, error } = await createEvent({ ...payload, panorama_url: 'pending' })
        if (error || !data) throw error ?? new Error('Nepodařilo se vytvořit.')
        savedId = (data as { id: string }).id
      }

      if (savedId) {
        if (panoramaFile) {
          setSaving(false)
          setCompressing(true)
          // Komprimuj panoramu před uploadem
          let fileToUpload = panoramaFile
          try {
            const result = await compressPanorama(panoramaFile, (msg) => {
              setCompressionInfo(msg)
            })
            fileToUpload = result.file
            if (result.savings > 0) {
              setCompressionInfo(`Zkomprimováno: ${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)} (−${result.savings}%)`)
            }
          } catch (e) {
            console.warn('[Upload] Komprimace selhala, nahrávám originál:', e)
          }
          setCompressing(false)
          setSaving(true)

          // Při editaci použij bezpečné nahrazení (smaže starý soubor)
          const oldUrl = event?.panorama_url ?? null
          const { url, error } = event
            ? await uploadPanoramaWithCleanup(fileToUpload, savedId, oldUrl)
            : await uploadPanorama(fileToUpload, savedId)
          if (error) throw error
          if (!event) await updateEvent(savedId, { panorama_url: url! })

          // Vygeneruj a nahraj malý náhled (preview) pro okamžité zobrazení
          try {
            const previewFile = await generatePreview(fileToUpload)
            if (previewFile) {
              const { url: pvUrl } = await uploadPanoramaPreview(previewFile, savedId)
              if (pvUrl) await updateEvent(savedId, { preview_url: pvUrl })
            }
          } catch (e) {
            console.warn('[Upload] Náhled se nepodařilo vytvořit:', e)
          }
        }
        if (imageFile) {
          const { url, error } = await uploadEventImage(imageFile, savedId)
          if (error) throw error
          await updateEvent(savedId, { event_image_url: url! })
        }
        // Analytics
        track(event ? 'admin_event_updated' : 'admin_event_created', { event_id: savedId })
      }

      onDone()
    } catch (err: unknown) {
      // Vytáhni skutečnou hlášku i z PostgrestError (není to Error instance)
      let msg = 'Nastala chyba.'
      if (err instanceof Error) msg = err.message
      else if (err && typeof err === 'object') {
        const e = err as { message?: string; details?: string; hint?: string; code?: string }
        msg = [e.message, e.details, e.hint, e.code && `(${e.code})`].filter(Boolean).join(' · ') || JSON.stringify(err)
      }
      console.error('[EventForm] save error:', err)
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const isEdit = !!event
  const lat = parseFloat(form.lat) || 50.0755
  const lng = parseFloat(form.lng) || 14.4378
  const radiusKm = parseInt(form.location_radius_km) || 0
  const yearFrom = parseInt(form.year_from) || 1900
  const yearTo = parseInt(form.year_to) || 1900
  const yearMid = Math.round((yearFrom + yearTo) / 2)

  return (
    <div style={{ maxWidth: 780 }}>
      {panoramaPreview && (
        <PanoramaPreviewModal
          url={panoramaPreview}
          onClose={() => {
            if (panoramaPreview.startsWith('blob:')) URL.revokeObjectURL(panoramaPreview)
            setPanoramaPreview(null)
          }}
        />
      )}
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, margin: '0 0 28px', letterSpacing: '-0.01em' }}>
        {isEdit ? `Editovat: ${event.title}` : 'Nová historická událost'}
      </h2>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* AI předvyplnění */}
        <div className="card" style={{ padding: 24, border: '1px solid var(--accent)', background: 'var(--paper-100, var(--surface))' }}>
          <p className="eyebrow" style={{ marginBottom: 6, color: 'var(--accent)' }}>✨ Předvyplnit přes AI</p>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 16px' }}>
            Zadej název a (přibližný) rok. AI navrhne datum, popisy CS/EN/DE, názvy EN/DE, rozsah let, kategorii a GPS.
            Vše si pak <strong>zkontroluj a uprav</strong> před uložením.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 240px' }}>
              <label className="label">Název události</label>
              <input className="input" value={aiTitle} onChange={e => setAiTitle(e.target.value)}
                placeholder="např. Bitva na Bílé hoře"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAiGenerate() } }}/>
            </div>
            <div style={{ width: 120 }}>
              <label className="label">Rok</label>
              <input className="input" type="number" value={aiYear} onChange={e => setAiYear(e.target.value)}
                placeholder="1620" min={-3000} max={2025}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAiGenerate() } }}/>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleAiGenerate} disabled={aiLoading}
              style={{ height: 44 }}>
              {aiLoading ? 'Generuji…' : '✨ Vygenerovat'}
            </button>
          </div>
          {aiError && (
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--accent-dark, #b85a3e)' }}>⚠️ {aiError}</p>
          )}
          {aiNote && (
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-2)', background: 'var(--paper-200, rgba(0,0,0,0.03))', padding: '10px 12px', borderRadius: 8 }}>
              ℹ️ {aiNote}
            </p>
          )}
        </div>

        {/* Základní info */}
        <div className="card" style={{ padding: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 20 }}>Základní informace</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">Název události *</label>
              <input className="input" value={form.title} onChange={set('title')} required placeholder="např. Bitva na Bílé hoře"/>
            </div>
            <div>
              <label className="label">Popis (zobrazí se po odeslání tipu) *</label>
              <textarea
                className="input" value={form.description}
                onChange={set('description') as React.ChangeEventHandler<HTMLTextAreaElement>}
                required rows={4} placeholder="Krátký popis události…" style={{ resize: 'vertical' }}
              />
            </div>

            {/* Překlady — volitelné. Prázdné = hra zobrazí český text jako fallback. */}
            <details style={{ border: '1px solid var(--line)', borderRadius: 8 }}>
              <summary style={{ cursor: 'pointer', padding: '10px 14px', fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>
                🌐 Překlady (EN / DE) — volitelné
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 14px 16px' }}>
                <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>
                  Když pole necháš prázdné, hra v daném jazyce zobrazí český text.
                </p>
                <div>
                  <label className="label">🇬🇧 Název (EN)</label>
                  <input className="input" value={form.title_en} onChange={set('title_en')} placeholder="e.g. Battle of White Mountain"/>
                </div>
                <div>
                  <label className="label">🇬🇧 Popis (EN)</label>
                  <textarea className="input" value={form.description_en} onChange={set('description_en') as React.ChangeEventHandler<HTMLTextAreaElement>} rows={4} style={{ resize: 'vertical' }} placeholder="Short event description…"/>
                </div>
                <div>
                  <label className="label">🇩🇪 Název (DE)</label>
                  <input className="input" value={form.title_de} onChange={set('title_de')} placeholder="z. B. Schlacht am Weißen Berg"/>
                </div>
                <div>
                  <label className="label">🇩🇪 Popis (DE)</label>
                  <textarea className="input" value={form.description_de} onChange={set('description_de') as React.ChangeEventHandler<HTMLTextAreaElement>} rows={4} style={{ resize: 'vertical' }} placeholder="Kurze Beschreibung des Ereignisses…"/>
                </div>
              </div>
            </details>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label className="label">Kategorie</label>
                <select className="input" value={form.category} onChange={set('category') as React.ChangeEventHandler<HTMLSelectElement>}>
                  <option value="">— bez kategorie —</option>
                  <option value="war">Války</option>
                  <option value="moments">Historické okamžiky</option>
                  <option value="places">Objevy míst</option>
                  <option value="inventions">Vynálezy</option>
                  <option value="art">Umění</option>
                  <option value="sports">Sportovní okamžiky</option>
                  <option value="mysteries">Záhady a legendy</option>
                  <option value="disasters">Katastrofy</option>
                </select>
              </div>
              <div>
                <label className="label">Obtížnost</label>
                <select className="input" value={form.difficulty} onChange={set('difficulty') as React.ChangeEventHandler<HTMLSelectElement>}>
                  <option value="1">★ Lehká</option>
                  <option value="2">★★ Střední</option>
                  <option value="3">★★★ Těžká</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Rok od / do */}
        <div className="card" style={{ padding: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Rok události</p>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>
            Zadej rozsah let. Hráč dostane plný počet bodů za libovolný rok v tomto rozsahu. Záporné = př. n. l.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
            <div>
              <label className="label">Rok od *</label>
              <input className="input" type="number" value={form.year_from} onChange={set('year_from')} required min={-3000} max={2025} placeholder="-1200"/>
            </div>
            <div>
              <label className="label">Rok do *</label>
              <input className="input" type="number" value={form.year_to} onChange={set('year_to')} required min={-3000} max={2025} placeholder="-1100"/>
            </div>
            <div style={{ padding: '10px 14px', background: 'var(--paper-200)', borderRadius: 8 }}>
              <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Střed</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18 }}>
                {formatYear(yearMid)}
              </div>
              {yearFrom !== yearTo && (
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>±{Math.round((yearTo - yearFrom) / 2)} let</div>
              )}
            </div>
          </div>
          {yearFrom > yearTo && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>Rok od musí být ≤ roku do.</div>
          )}
          <div style={{ marginTop: 14 }}>
            <label className="label">Přesné datum (volitelné) — pro „Tento den v historii"</label>
            <input className="input" type="date" value={form.event_date} onChange={set('event_date')} style={{ maxWidth: 220 }}/>
            <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>Den a měsíc se nabídne v kalendáři denních výzev. Jen n. l.</p>
          </div>
        </div>

        {/* Poloha + mapa */}
        <div className="card" style={{ padding: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 20 }}>Poloha místa</p>

          {/* Interaktivní mapa */}
          <AdminMap lat={lat} lng={lng} radiusKm={radiusKm} onLocationChange={handleMapClick}/>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
            <div>
              <label className="label">Zeměpisná šířka (lat) *</label>
              <input className="input" type="number" step="0.000001" value={form.lat} onChange={set('lat')} required/>
            </div>
            <div>
              <label className="label">Zeměpisná délka (lng) *</label>
              <input className="input" type="number" step="0.000001" value={form.lng} onChange={set('lng')} required/>
            </div>
            <div>
              <label className="label">Radius přesnosti (km, volitelné)</label>
              <input className="input" type="number" value={form.location_radius_km} onChange={set('location_radius_km')} min={0} max={500} placeholder="0 = přesné místo"/>
              <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                {radiusKm > 0
                  ? `Plný počet bodů do ${radiusKm} km. Pak -1 bod/km.`
                  : '0 = bodování podle přesné vzdálenosti'}
              </p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
            Tip: klikni na mapu pro výběr místa, nebo zadej souřadnice ručně. Souřadnice zkopíruješ z Google Maps (pravý klik na místo).
          </p>
        </div>

        {/* Soubory */}
        <div className="card" style={{ padding: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 20 }}>Soubory</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">360° panorama * (JPG/PNG, max 50 MB)</label>
              <DropZone accept="image/jpeg,image/png,image/webp" maxMB={50} file={panoramaFile} currentUrl={event?.panorama_url} onChange={(f) => { setPanoramaFile(f); setCompressionInfo(f ? `Vybráno: ${formatFileSize(f.size)} — bude zkomprimováno` : null) }} ref={panoramaRef}/>
              {compressionInfo && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
                  {compressing ? <><span className="spinner" style={{ width: 12, height: 12 }}/> </> : '💾 '}{compressionInfo}
                </div>
              )}
              {/* Preview tlačítko — zobrazí existující nebo nově vybranou panoramu */}
              {(panoramaFile || (event?.panorama_url && event.panorama_url !== 'pending')) && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginTop: 8, fontSize: 13 }}
                  onClick={() => {
                    if (panoramaFile) {
                      const url = URL.createObjectURL(panoramaFile)
                      setPanoramaPreview(url)
                    } else if (event?.panorama_url && event.panorama_url !== 'pending') {
                      setPanoramaPreview(event.panorama_url)
                    }
                  }}
                >
                  👁 Náhled panoramy
                </button>
              )}
            </div>
            <div>
              <label className="label">Doplňkový obrázek události (JPG/PNG, max 10 MB)</label>
              <DropZone accept="image/jpeg,image/png,image/webp" maxMB={10} file={imageFile} currentUrl={event?.event_image_url ?? undefined} onChange={setImageFile} ref={imageRef}/>
            </div>
          </div>
        </div>

        {/* Publikování */}
        <div className="card" style={{ padding: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.published} onChange={set('published')} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}/>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Publikovat ihned</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Událost bude viditelná pro hráče</div>
            </div>
          </label>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="btn btn-ghost" onClick={onDone}>Zrušit</button>
          <button type="submit" className="btn btn-accent" disabled={saving}>
            {saving ? <span className="spinner" style={{ width: 14, height: 14 }}/> : null}
            {saving ? 'Ukládám…' : isEdit ? 'Uložit změny' : 'Vytvořit událost'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Drop zone ─────────────────────────────────────────────
const DropZone = forwardRef<HTMLInputElement, {
  accept: string; maxMB: number; file: File | null
  currentUrl?: string; onChange: (f: File | null) => void
}>(({ accept, maxMB, file, currentUrl, onChange }, ref) => {
  const [dragOver, setDragOver] = useState(false)
  const [sizeError, setSizeError] = useState<string | null>(null)

  function handle(f: File | null) {
    setSizeError(null)
    if (!f) { onChange(null); return }
    if (f.size > maxMB * 1024 * 1024) { setSizeError(`Soubor je příliš velký (max ${maxMB} MB)`); return }
    onChange(f)
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handle(e.dataTransfer.files[0] ?? null) }}
        onClick={() => (ref as React.RefObject<HTMLInputElement>).current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--line-strong)'}`,
          borderRadius: 10, padding: 24, textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'rgba(217,119,87,0.04)' : 'var(--paper-100)',
          transition: 'all 160ms',
        }}
      >
        <input ref={ref} type="file" accept={accept} style={{ display: 'none' }} onChange={e => handle(e.target.files?.[0] ?? null)}/>
        {file ? (
          <div style={{ fontSize: 14 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 500 }}>✓ {file.name}</span>
            <span style={{ color: 'var(--ink-3)', marginLeft: 8 }}>({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
          </div>
        ) : currentUrl ? (
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Aktuální soubor nastaven. Přetáhni nebo klikni pro výměnu.</div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 4 }}>Přetáhni soubor nebo klikni pro výběr</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>max {maxMB} MB</div>
          </div>
        )}
      </div>
      {sizeError && <p className="field-error">{sizeError}</p>}
    </div>
  )
})
DropZone.displayName = 'DropZone'

// ── Panorama Preview Modal ────────────────────────────────
declare const pannellum: {
  viewer: (container: HTMLElement, config: Record<string, unknown>) => { destroy: () => void }
}

function PanoramaPreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const viewer = pannellum.viewer(containerRef.current, {
      type: 'equirectangular',
      panorama: url,
      autoLoad: true,
      showControls: true,
      hfov: 120,
    })
    return () => { viewer.destroy() }
  }, [url])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(0,0,0,0.5)' }}>
        <span style={{ color: '#f5f1e8', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.14em' }}>NÁHLED PANORAMY</span>
        <button
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 16px', color: '#f5f1e8', fontSize: 13, cursor: 'pointer' }}
        >
          ✕ Zavřít
        </button>
      </div>
      <div ref={containerRef} style={{ flex: 1 }}/>
    </div>
  )
}

function AdminLoading() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spinner" style={{ width: 28, height: 28 }}/>
    </div>
  )
}

// ── Statistika obtížnosti události (Ø zahrané skóre) ──────
function EventScoreStat({ ev }: { ev: Event }) {
  const n = ev.score_count ?? 0
  if (n < 5) {
    return <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{n > 0 ? `${n}× · málo dat` : '–'}</span>
  }
  const avg = Math.round((ev.score_sum ?? 0) / n)
  const avgLoc = Math.round((ev.score_loc_sum ?? 0) / n)
  const avgYear = Math.round((ev.score_year_sum ?? 0) / n)
  // avg je z max 1000 (500 poloha + 500 rok); nižší = těžší
  const tier = avg >= 650
    ? { label: 'Lehká', color: '#1d6b3a', bg: 'rgba(39,174,96,0.12)' }
    : avg >= 400
      ? { label: 'Střední', color: 'var(--accent-deep)', bg: 'rgba(217,119,87,0.12)' }
      : { label: 'Těžká', color: '#b3261e', bg: 'rgba(192,57,43,0.12)' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)' }}>{avg}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: tier.color, background: tier.bg, padding: '2px 7px', borderRadius: 999 }}>{tier.label}</span>
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
        📍 {avgLoc} · 📅 {avgYear} · {n}×
      </span>
    </div>
  )
}
