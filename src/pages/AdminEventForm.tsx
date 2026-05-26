// Formulář pro přidání/editaci události — year_from/year_to + hfov
import { useState, useRef, forwardRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createEvent, updateEvent, uploadPanorama, uploadEventImage } from '@/lib/supabase'
import type { Event } from '@/types/database'
import AdminMap from '@/components/AdminMap'

type FormData = {
  title: string; description: string
  year_from: string; year_to: string
  lat: string; lng: string
  location_radius_km: string
  category: string; difficulty: string
  published: boolean; hfov: string
}

interface Props { event?: Event; onDone: () => void }

export default function EventForm({ event, onDone }: Props) {
  const { user } = useAuth()
  const [form, setForm] = useState<FormData>({
    title: event?.title ?? '',
    description: event?.description ?? '',
    year_from: String(event?.year_from ?? event?.year ?? 1900),
    year_to: String(event?.year_to ?? event?.year ?? 1900),
    lat: String(event?.lat ?? 50.0755),
    lng: String(event?.lng ?? 14.4378),
    location_radius_km: String(event?.location_radius_km ?? 0),
    category: event?.category ?? '',
    difficulty: String(event?.difficulty ?? 2),
    published: event?.published ?? false,
    hfov: String(event?.hfov ?? 100),
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

  const yearFrom = parseInt(form.year_from) || 1900
  const yearTo = parseInt(form.year_to) || 1900
  const yearMid = Math.round((yearFrom + yearTo) / 2)
  const hfov = parseInt(form.hfov) || 100

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (yearFrom > yearTo) { setError('Rok od musí být menší nebo roven roku do.'); return }
    setError(null); setSaving(true)
    try {
      const payload = {
        title: form.title, description: form.description,
        year: yearMid, year_from: yearFrom, year_to: yearTo,
        year_range: Math.round((yearTo - yearFrom) / 2),
        lat: parseFloat(form.lat), lng: parseFloat(form.lng),
        location_radius_km: parseInt(form.location_radius_km) || 0,
        category: form.category || null,
        difficulty: parseInt(form.difficulty) as 1 | 2 | 3,
        published: form.published,
        panorama_url: event?.panorama_url ?? '',
        event_image_url: event?.event_image_url ?? null,
        created_by: user.id, hfov,
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
    } finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, margin: '0 0 28px', letterSpacing: '-0.01em' }}>
        {event ? `Editovat: ${event.title}` : 'Nová historická událost'}
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
              <label className="label">Popis *</label>
              <textarea className="input" value={form.description} onChange={set('description') as React.ChangeEventHandler<HTMLTextAreaElement>} required rows={4} style={{ resize: 'vertical' }} placeholder="Krátký popis události…"/>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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

        {/* Rok */}
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
              <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Střed / zobrazený rok</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18 }}>
                {yearMid < 0 ? `${Math.abs(yearMid)} př. n. l.` : `${yearMid} n. l.`}
              </div>
              {yearFrom !== yearTo && (
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>±{Math.round((yearTo - yearFrom) / 2)} let</div>
              )}
            </div>
          </div>
          {yearFrom > yearTo && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>Rok od musí být ≤ roku do.</div>
          )}
        </div>

        {/* Poloha */}
        <div className="card" style={{ padding: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 20 }}>Poloha místa</p>
          <AdminMap
            lat={parseFloat(form.lat) || 50.0755}
            lng={parseFloat(form.lng) || 14.4378}
            radiusKm={parseInt(form.location_radius_km) || 0}
            onLocationChange={(lat, lng) => setForm(f => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }))}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
            <div>
              <label className="label">Lat *</label>
              <input className="input" type="number" step="0.000001" value={form.lat} onChange={set('lat')} required/>
            </div>
            <div>
              <label className="label">Lng *</label>
              <input className="input" type="number" step="0.000001" value={form.lng} onChange={set('lng')} required/>
            </div>
            <div>
              <label className="label">Radius (km)</label>
              <input className="input" type="number" value={form.location_radius_km} onChange={set('location_radius_km')} min={0} max={500}/>
              <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>0 = přesné místo</p>
            </div>
          </div>
        </div>

        {/* Zoom panoramy */}
        <div className="card" style={{ padding: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Výchozí zoom 360° panoramy</p>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>
            Nižší hodnota = více přiblíženo. Vyšší = širší záběr, více oddáleno.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>🔍 Přiblíženo</span>
            <input type="range" min={50} max={120} value={form.hfov} onChange={set('hfov')} style={{ flex: 1 }}/>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>🌐 Oddáleno</span>
            <div style={{ padding: '6px 14px', background: 'var(--paper-200)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 16, minWidth: 52, textAlign: 'center', fontWeight: 500 }}>
              {form.hfov}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {[
              { val: 60, label: 'Interiér' },
              { val: 90, label: 'Doporučeno' },
              { val: 110, label: 'Krajina' },
              { val: 120, label: 'Max' },
            ].map(p => (
              <button key={p.val} type="button" onClick={() => setForm(f => ({ ...f, hfov: String(p.val) }))}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${hfov === p.val ? 'var(--accent)' : 'var(--line-strong)'}`, background: hfov === p.val ? 'rgba(217,119,87,0.1)' : 'transparent', color: hfov === p.val ? 'var(--accent-deep)' : 'var(--ink-3)', cursor: 'pointer' }}>
                {p.val} — {p.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 10 }}>
            💡 Ideální rozlišení panoramy: <strong>4096×2048 px</strong> (poměr 2:1), JPG 85%, ~3–8 MB
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
              <label className="label">Doplňkový obrázek (JPG/PNG, max 10 MB)</label>
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
          <button type="submit" className="btn btn-accent" disabled={saving || yearFrom > yearTo}>
            {saving ? <span className="spinner" style={{ width: 14, height: 14 }}/> : null}
            {saving ? 'Ukládám…' : event ? 'Uložit změny' : 'Vytvořit událost'}
          </button>
        </div>
      </form>
    </div>
  )
}

const DropZone = forwardRef<HTMLInputElement, {
  accept: string; maxMB: number; file: File | null; currentUrl?: string; onChange: (f: File | null) => void
}>(({ accept, maxMB, file, currentUrl, onChange }, ref) => {
  const [dragOver, setDragOver] = useState(false)
  const [sizeError, setSizeError] = useState<string | null>(null)
  function handle(f: File | null) {
    setSizeError(null)
    if (!f) { onChange(null); return }
    if (f.size > maxMB * 1024 * 1024) { setSizeError(`Max ${maxMB} MB`); return }
    onChange(f)
  }
  return (
    <div>
      <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handle(e.dataTransfer.files[0] ?? null) }}
        onClick={() => (ref as React.RefObject<HTMLInputElement>).current?.click()}
        style={{ border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--line-strong)'}`, borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(217,119,87,0.04)' : 'var(--paper-100)', transition: 'all 160ms' }}>
        <input ref={ref} type="file" accept={accept} style={{ display: 'none' }} onChange={e => handle(e.target.files?.[0] ?? null)}/>
        {file ? <div style={{ fontSize: 14 }}><span style={{ color: 'var(--accent)', fontWeight: 500 }}>✓ {file.name}</span> <span style={{ color: 'var(--ink-3)' }}>({(file.size/1024/1024).toFixed(1)} MB)</span></div>
          : currentUrl ? <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Aktuální soubor nastaven. Klikni pro výměnu.</div>
          : <div><div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 4 }}>Přetáhni nebo klikni</div><div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>max {maxMB} MB</div></div>}
      </div>
      {sizeError && <p className="field-error">{sizeError}</p>}
    </div>
  )
})
DropZone.displayName = 'DropZone'
