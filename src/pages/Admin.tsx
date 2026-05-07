import { useEffect, useState, useRef } from 'react'
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

  // Admin guard
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

  if (loading || fetching) return <AdminLoading/>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>

      {/* Header */}
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

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {panel === 'list' && (
          <EventList events={events} onEdit={openEdit} onToggle={handleToggle} onDelete={handleDelete}/>
        )}

        {panel === 'new' && (
          <EventForm onDone={closePanel}/>
        )}

        {panel === 'edit' && editingEvent && (
          <EventForm event={editingEvent} onDone={closePanel}/>
        )}
      </div>
    </div>
  )
}

// ── Event list table ──────────────────────────────────────
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
            {['Název', 'Rok', 'Obtížnost', 'Stav', 'Zahráno', 'Akce'].map(h => (
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
              </td>
              <td style={{ padding: '12px 16px' }}>
                {'★'.repeat(ev.difficulty)}{'☆'.repeat(3 - ev.difficulty)}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <span className={`badge ${ev.published ? 'badge-success' : 'badge-neutral'}`}>
                  {ev.published ? 'Publikováno' : 'Skrytá'}
                </span>
              </td>
              <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {ev.play_count}×
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

// ── Event form ────────────────────────────────────────────
type FormData = {
  title: string; description: string; year: string
  lat: string; lng: string
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
        // Vytvoř nejdřív bez souboru, abychom dostali ID
        const { data, error } = await createEvent({ ...payload, panorama_url: 'pending' })
        if (error || !data) throw error ?? new Error('Nepodařilo se vytvořit.')
        savedId = (data as { id: string }).id
      }

      // Upload souborů
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

  return (
    <div style={{ maxWidth: 720 }}>
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
              <label className="label">Popis (zobrazí se hráčovi po odeslání tipu) *</label>
              <textarea
                className="input"
                value={form.description}
                onChange={set('description') as React.ChangeEventHandler<HTMLTextAreaElement>}
                required
                rows={4}
                placeholder="Krátký popis události, historický kontext…"
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label className="label">Rok * (záporné = př. n. l.)</label>
                <input className="input" type="number" value={form.year} onChange={set('year')} required min={-3000} max={2025}/>
              </div>
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

        {/* Poloha */}
        <div className="card" style={{ padding: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 20 }}>Poloha místa</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="label">Zeměpisná šířka (lat) *</label>
              <input className="input" type="number" step="0.000001" value={form.lat} onChange={set('lat')} required placeholder="50.0755"/>
            </div>
            <div>
              <label className="label">Zeměpisná délka (lng) *</label>
              <input className="input" type="number" step="0.000001" value={form.lng} onChange={set('lng')} required placeholder="14.4378"/>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10 }}>
            Tip: souřadnice snadno zkopíruješ z Google Maps — klikni pravým tlačítkem na místo.
          </p>
        </div>

        {/* Soubory */}
        <div className="card" style={{ padding: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 20 }}>Soubory</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">360° panorama * (JPG/PNG, max 50 MB)</label>
              <DropZone
                accept="image/jpeg,image/png,image/webp"
                maxMB={50}
                file={panoramaFile}
                currentUrl={event?.panorama_url}
                onChange={setPanoramaFile}
                ref={panoramaRef}
              />
            </div>
            <div>
              <label className="label">Doplňkový obrázek události (JPG/PNG, max 10 MB)</label>
              <DropZone
                accept="image/jpeg,image/png,image/webp"
                maxMB={10}
                file={imageFile}
                currentUrl={event?.event_image_url ?? undefined}
                onChange={setImageFile}
                ref={imageRef}
              />
            </div>
          </div>
        </div>

        {/* Publikování */}
        <div className="card" style={{ padding: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.published}
              onChange={set('published')}
              style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
            />
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
import { forwardRef } from 'react'

const DropZone = forwardRef<HTMLInputElement, {
  accept: string; maxMB: number; file: File | null
  currentUrl?: string; onChange: (f: File | null) => void
}>(({ accept, maxMB, file, currentUrl, onChange }, ref) => {
  const [dragOver, setDragOver] = useState(false)
  const [sizeError, setSizeError] = useState<string | null>(null)

  function handle(f: File | null) {
    setSizeError(null)
    if (!f) { onChange(null); return }
    if (f.size > maxMB * 1024 * 1024) {
      setSizeError(`Soubor je příliš velký (max ${maxMB} MB)`)
      return
    }
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
          borderRadius: 10,
          padding: 24,
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'rgba(217,119,87,0.04)' : 'var(--paper-100)',
          transition: 'all 160ms',
        }}
      >
        <input
          ref={ref}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={e => handle(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div style={{ fontSize: 14 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 500 }}>✓ {file.name}</span>
            <span style={{ color: 'var(--ink-3)', marginLeft: 8 }}>({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
          </div>
        ) : currentUrl ? (
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            Aktuální soubor je nastaven. Přetáhni nebo klikni pro výměnu.
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 4 }}>Přetáhni soubor nebo klikni pro výběr</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>max {maxMB} MB · {accept.replace(/image\//g, '').toUpperCase()}</div>
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
