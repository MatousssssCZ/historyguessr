import { useEffect, useState, useRef, forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getAdminEvents, createEvent, updateEvent, deleteEvent, togglePublished, uploadPanorama, uploadEventImage } from '@/lib/supabase'
import type { Event } from '@/types/database'

type Panel = 'list' | 'new' | 'edit'

export default function AdminPage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [panel, setPanel] = useState<Panel>('list')
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !isAdmin) navigate('/menu')
  }, [isAdmin, loading])

  useEffect(() => { loadEvents() }, [])

  async function loadEvents() {
    setFetching(true)
    const { data } = await getAdminEvents()
    setEvents(data ?? [])
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
          <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/menu')}>← Menu</button>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>Správa událostí</h1>
          <span className="badge badge-neutral">{events.length} událostí</span>
        </div>
        {panel === 'list' && (
          <button className="btn btn-accent" onClick={() => setPanel('new')}>+ Nová událost</button>
        )}
        {panel !== 'list' && (
          <button className="btn btn-ghost" onClick={closePanel}>← Zpět na seznam</button>
        )}
      </header>

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
  if (events.length === 0) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: 'var(--ink-3)', marginBottom: 16 }}>Žádné události. Začni přidáním první.</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--paper-100)', borderBottom: '1px solid var(--line)' }}>
            {['Název', 'Rok', 'Radius', 'Obtížnost', 'Stav', 'Akce'].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--ink-3)', fontWeight: 500 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => (
            <tr key={ev.id} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--paper-100)' }}>
              <td style={{ padding: '12px 16px' }}>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>{ev.title}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{ev.category ?? '—'}</div>
              </td>
              <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {ev.year < 0 ? `${Math.abs(ev.year)} př.` : ev.year}
                {ev.year_range > 0 && <span style={{ color: 'var(--ink-3)' }}> ±{ev.year_range}</span>}
              </td>
              <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {ev.location_radius_km > 0 ? `${ev.location_radius_km} km` : '—'}
              </td>
              <td style={{ padding: '12px 16px' }}>{'★'.repeat(ev.difficulty)}{'☆'.repeat(3 - ev.difficulty)}</td>
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
    </div>
  )
}

// ── Admin mapa s kružnicí ─────────────────────────────────
function AdminMap({ lat, lng, radiusKm, onLocationChange }: {
  lat: number; lng: number; radiusKm: number
  onLocationChange: (lat: number, lng: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    onLocationChange(90 - y * 180, x * 360 - 180)
  }

  const pinX = ((lng + 180) / 360) * 100
  const pinY = ((90 - lat) / 180) * 100

  // Přibližný radius jako % šířky mapy (1° ≈ 111 km)
  const radiusPctW = radiusKm > 0 ? (radiusKm / (360 * 111)) * 100 : 0
  const radiusPctH = radiusKm > 0 ? (radiusKm / (180 * 111)) * 100 : 0

  return (
    <div
      ref={ref}
      onClick={handleClick}
      style={{
        width: '100%', height: 300,
        background: '#c8d8e8',
        borderRadius: 10,
        border: '1px solid var(--line)',
        cursor: 'crosshair',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* SVG světová mapa */}
      <svg width="100%" height="100%" viewBox="0 0 360 180" preserveAspectRatio="xMidYMid meet" style={{ opacity: 0.75 }}>
        <rect width="360" height="180" fill="#c8d8e8"/>
        {/* Mřížka */}
        {[0,60,120,180,240,300,360].map(x => (
          <line key={`v${x}`} x1={x} y1={0} x2={x} y2={180} stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
        ))}
        {[0,45,90,135,180].map(y => (
          <line key={`h${y}`} x1={0} y1={y} x2={360} y2={y} stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
        ))}
        {/* Kontinenty — zjednodušené */}
        <path d="M40 20 L90 15 L105 35 L95 65 L70 80 L45 75 L30 55 Z" fill="#c9b99a"/>
        <path d="M75 95 L100 90 L110 120 L95 155 L70 160 L60 140 L65 110 Z" fill="#c9b99a"/>
        <path d="M155 15 L190 12 L200 35 L185 45 L165 42 L150 30 Z" fill="#c9b99a"/>
        <path d="M160 50 L195 48 L205 90 L195 130 L170 140 L148 120 L145 80 Z" fill="#c9b99a"/>
        <path d="M195 10 L310 8 L320 50 L295 75 L240 80 L200 60 L195 35 Z" fill="#c9b99a"/>
        <path d="M265 110 L310 105 L320 135 L295 150 L265 145 L255 125 Z" fill="#c9b99a"/>
      </svg>

      {/* Kružnice radiusu */}
      {radiusKm > 0 && (
        <div style={{
          position: 'absolute',
          left: `${pinX}%`,
          top: `${pinY}%`,
          width: `${radiusPctW * 2}%`,
          height: `${radiusPctH * 2}%`,
          transform: 'translate(-50%, -50%)',
          border: '2px solid rgba(217,119,87,0.7)',
          borderRadius: '50%',
          background: 'rgba(217,119,87,0.1)',
          pointerEvents: 'none',
        }}/>
      )}

      {/* Pin */}
      <div style={{
        position: 'absolute',
        left: `${pinX}%`, top: `${pinY}%`,
        transform: 'translate(-50%, -100%)',
        pointerEvents: 'none',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
      }}>
        <svg width="22" height="28" viewBox="0 0 22 28" fill="none">
          <path d="M11 27s9-9 9-16a9 9 0 1 0-18 0c0 7 9 16 9 16Z" fill="var(--accent)" stroke="var(--accent-deep)" strokeWidth="1"/>
          <circle cx="11" cy="11" r="3" fill="#fff"/>
        </svg>
      </div>

      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em',
        color: 'var(--ink-3)', background: 'rgba(245,241,232,0.9)',
        padding: '3px 10px', borderRadius: 999, pointerEvents: 'none',
      }}>
        KLIKNI PRO VÝBĚR MÍSTA
      </div>
    </div>
  )
}

// ── Event form ────────────────────────────────────────────
type FormData = {
  title: string; description: string; year: string
  lat: string; lng: string
  location_radius_km: string; year_range: string
  category: string; difficulty: string; published: boolean
}

function EventForm({ event, onDone }: { event?: Event; onDone: () => void }) {
  const { user } = useAuth()
  const [form, setForm] = useState<FormData>({
    title: event?.title ?? '',
    description: event?.description ?? '',
    year: String(event?.year ?? 1900),
    lat: String(event?.lat ?? 50.0755),
    lng: String(event?.lng ?? 14.4378),
    location_radius_km: String(event?.location_radius_km ?? 0),
    year_range: String(event?.year_range ?? 0),
    category: event?.category ?? '',
    difficulty: String(event?.difficulty ?? 2),
    published: event?.published ?? false,
  })
  const [panoramaFile, setPanoramaFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const panoramaRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)

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
      const payload = {
        title: form.title,
        description: form.description,
        year: parseInt(form.year),
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        location_radius_km: parseInt(form.location_radius_km) || 0,
        year_range: parseInt(form.year_range) || 0,
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
          const { url, error } = await uploadPanorama(panoramaFile, savedId)
          if (error) throw error
          await updateEvent(savedId, { panorama_url: url! })
        }
        if (imageFile) {
          const { url, error } = await uploadEventImage(imageFile, savedId)
          if (error) throw error
          await updateEvent(savedId, { event_image_url: url! })
        }
      }

      onDone()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nastala chyba.')
    } finally {
      setSaving(false)
    }
  }

  const isEdit = !!event
  const lat = parseFloat(form.lat) || 50.0755
  const lng = parseFloat(form.lng) || 14.4378
  const radiusKm = parseInt(form.location_radius_km) || 0

  return (
    <div style={{ maxWidth: 780 }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, margin: '0 0 28px', letterSpacing: '-0.01em' }}>
        {isEdit ? `Editovat: ${event.title}` : 'Nová historická událost'}
      </h2>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label className="label">Kategorie</label>
                <select className="input" value={form.category} onChange={set('category') as React.ChangeEventHandler<HTMLSelectElement>}>
                  <option value="">— bez kategorie —</option>
                  <option value="war">Válka</option>
                  <option value="culture">Kultura</option>
                  <option value="science">Věda</option>
                  <option value="politics">Politika</option>
                  <option value="religion">Náboženství</option>
                  <option value="exploration">Průzkum</option>
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

        {/* Rok + rozptyl */}
        <div className="card" style={{ padding: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 20 }}>Rok události</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="label">Rok * (záporné = př. n. l.)</label>
              <input className="input" type="number" value={form.year} onChange={set('year')} required min={-3000} max={2025} placeholder="např. -79 nebo 1618"/>
            </div>
            <div>
              <label className="label">Časový rozptyl ±roků (volitelné)</label>
              <input className="input" type="number" value={form.year_range} onChange={set('year_range')} min={0} max={500} placeholder="0 = přesný rok"/>
              <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                Hráč dostane plný počet bodů pokud trefí rok ±{form.year_range || 0} let. Pak -1 bod za každý rok.
              </p>
            </div>
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
              <DropZone accept="image/jpeg,image/png,image/webp" maxMB={50} file={panoramaFile} currentUrl={event?.panorama_url} onChange={setPanoramaFile} ref={panoramaRef}/>
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

function AdminLoading() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spinner" style={{ width: 28, height: 28 }}/>
    </div>
  )
}
