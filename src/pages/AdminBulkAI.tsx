import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { suggestEvents, generateEventDraft } from '@/lib/ai'
import type { EventSuggestion } from '@/lib/ai'
import { buildPanoramaPrompt } from '@/lib/panoramaPrompt'
import { createEvent } from '@/lib/supabase'

const CAT_LABELS: Record<string, string> = {
  war: '⚔ Války', moments: '📜 Historické okamžiky', places: '🧭 Objevy míst',
  inventions: '💡 Vynálezy', art: '🎨 Umění', sports: '🏅 Sportovní okamžiky',
  mysteries: '🔮 Záhady a legendy', disasters: '🌋 Katastrofy',
}
const CATEGORIES = Object.keys(CAT_LABELS)

type Draft = {
  title: string; title_en: string; title_de: string
  description: string; description_en: string; description_de: string
  event_date: string; year_from: string; year_to: string
  lat: string; lng: string; category: string
  panorama_prompt: string
}

type Item = {
  key: string
  suggestion: EventSuggestion
  approved: boolean
  generating: boolean
  genError?: string
  draft?: Draft
  saved?: boolean
  saving?: boolean
  saveError?: string
}

function fmtYear(y: number | null): string {
  if (y == null) return '—'
  return y < 0 ? `${Math.abs(y)} př. n. l.` : String(y)
}

export default function AdminBulkAIPage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  useEffect(() => { if (!loading && !isAdmin) navigate('/menu') }, [loading, isAdmin])

  const [count, setCount] = useState('10')
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])

  function patch(key: string, p: Partial<Item>) {
    setItems(prev => prev.map(it => it.key === key ? { ...it, ...p } : it))
  }
  function patchDraft(key: string, dp: Partial<Draft>) {
    setItems(prev => prev.map(it => it.key === key && it.draft ? { ...it, draft: { ...it.draft, ...dp } } : it))
  }

  async function handleSuggest() {
    const n = Math.min(Math.max(parseInt(count) || 10, 1), 50)
    setSuggesting(true); setSuggestError(null)
    try {
      const list = await suggestEvents(n)
      setItems(list.map((s, i) => ({ key: `${Date.now()}_${i}`, suggestion: s, approved: true, generating: false })))
    } catch (e: any) {
      setSuggestError(e?.message || 'Návrh selhal.')
    } finally {
      setSuggesting(false)
    }
  }

  function draftFromAi(s: EventSuggestion, d: Awaited<ReturnType<typeof generateEventDraft>>): Draft {
    const year_from = d.year_from != null ? String(d.year_from) : (s.year != null ? String(s.year) : '')
    const year_to = d.year_to != null ? String(d.year_to) : (s.year != null ? String(s.year) : '')
    const lat = d.lat != null ? d.lat.toFixed(6) : ''
    const lng = d.lng != null ? d.lng.toFixed(6) : ''
    const title = d.title_cs ?? s.title
    const description = d.description_cs ?? ''
    const period = year_from && year_to && year_from !== year_to ? `${year_from}–${year_to}` : (year_from || '')
    return {
      title,
      title_en: d.title_en ?? '',
      title_de: d.title_de ?? '',
      description,
      description_en: d.description_en ?? '',
      description_de: d.description_de ?? '',
      event_date: d.event_date ?? '',
      year_from, year_to,
      lat, lng,
      category: d.category ?? s.category ?? '',
      panorama_prompt: buildPanoramaPrompt({
        title, date: d.event_date ?? '', period,
        location: lat && lng ? `${lat}, ${lng}` : '', description,
      }),
    }
  }

  async function generateOne(key: string) {
    const it = items.find(x => x.key === key)
    if (!it) return
    patch(key, { generating: true, genError: undefined })
    try {
      const d = await generateEventDraft(it.suggestion.title, it.suggestion.year ?? '')
      patch(key, { generating: false, draft: draftFromAi(it.suggestion, d) })
    } catch (e: any) {
      patch(key, { generating: false, genError: e?.message || 'Generování selhalo.' })
    }
  }

  async function generateAllApproved() {
    for (const it of items) {
      if (it.approved && !it.draft && !it.generating) {
        // sekvenčně, aby se nepřetížilo API
        // eslint-disable-next-line no-await-in-loop
        await generateOne(it.key)
      }
    }
  }

  async function saveOne(key: string) {
    const it = items.find(x => x.key === key)
    if (!it || !it.draft || it.saved) return
    const d = it.draft
    const yearFrom = parseInt(d.year_from) || (it.suggestion.year ?? 0)
    const yearTo = parseInt(d.year_to) || yearFrom
    const yearMid = Math.round((yearFrom + yearTo) / 2)
    patch(key, { saving: true, saveError: undefined })
    try {
      const { error } = await createEvent({
        title: d.title,
        description: d.description,
        title_en: d.title_en.trim() || null,
        description_en: d.description_en.trim() || null,
        title_de: d.title_de.trim() || null,
        description_de: d.description_de.trim() || null,
        year: yearMid,
        year_from: yearFrom,
        year_to: yearTo,
        year_range: Math.round((yearTo - yearFrom) / 2),
        event_date: d.event_date.trim() || null,
        lat: parseFloat(d.lat) || 0,
        lng: parseFloat(d.lng) || 0,
        location_radius_km: 0,
        category: d.category || null,
        difficulty: 2,
        published: false,
        status: 'draft',
        panorama_prompt: d.panorama_prompt.trim() || null,
        panorama_url: 'pending',
      })
      if (error) throw error
      patch(key, { saving: false, saved: true })
    } catch (e: any) {
      patch(key, { saving: false, saveError: e?.message || 'Uložení selhalo.' })
    }
  }

  async function saveAll() {
    for (const it of items) {
      if (it.approved && it.draft && !it.saved && !it.saving) {
        // eslint-disable-next-line no-await-in-loop
        await saveOne(it.key)
      }
    }
  }

  const approvedCount = items.filter(i => i.approved).length
  const generatedCount = items.filter(i => i.approved && i.draft).length
  const savedCount = items.filter(i => i.saved).length

  if (loading) return null

  const label = 'label'
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/admin')}>← Admin</button>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>Hromadné AI zadávání</h1>
        </div>
      </header>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px' }}>
        {/* Krok 1 — zadání počtu */}
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <p className="eyebrow" style={{ marginBottom: 12 }}>1 · Kolik událostí navrhnout</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ width: 120 }}>
              <label className={label}>Počet (1–50)</label>
              <input className="input" type="number" min={1} max={50} value={count} onChange={e => setCount(e.target.value)} />
            </div>
            <button className="btn btn-accent" onClick={handleSuggest} disabled={suggesting} style={{ height: 44 }}>
              {suggesting ? 'Navrhuji…' : '✨ Navrhnout události'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', flex: '1 1 220px' }}>
              AI projde existující sbírku, najde málo zastoupená období / oblasti / kategorie a vyhne se duplicitám.
            </span>
          </div>
          {suggestError && <p style={{ marginTop: 12, fontSize: 13, color: 'var(--accent-dark, #b85a3e)' }}>⚠️ {suggestError}</p>}
        </div>

        {items.length > 0 && (
          <>
            {/* Hromadné akce */}
            <div className="card" style={{ padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginRight: 'auto' }}>
                Schváleno {approvedCount}/{items.length} · vygenerováno {generatedCount} · uloženo {savedCount}
              </span>
              <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setItems(prev => prev.map(i => ({ ...i, approved: true })))}>Schválit vše</button>
              <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setItems(prev => prev.map(i => ({ ...i, approved: false })))}>Zamítnout vše</button>
              <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={generateAllApproved}>🪄 Vygenerovat data (schválené)</button>
              <button className="btn btn-accent" style={{ fontSize: 13 }} onClick={saveAll} disabled={generatedCount === 0}>💾 Uložit schválené jako drafty</button>
            </div>

            {/* Seznam návrhů */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map(it => (
                <div key={it.key} className="card" style={{ padding: 18, opacity: it.approved ? 1 : 0.55, border: it.saved ? '1px solid var(--success, #5c9468)' : undefined }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={it.approved} onChange={() => patch(it.key, { approved: !it.approved })} style={{ width: 18, height: 18, marginTop: 3, accentColor: 'var(--accent)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{it.suggestion.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                        {fmtYear(it.suggestion.year)} · {it.suggestion.country ?? '—'} · {it.suggestion.category ? (CAT_LABELS[it.suggestion.category] ?? it.suggestion.category) : '—'}
                      </div>
                      {it.suggestion.reason && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 6, fontStyle: 'italic' }}>„{it.suggestion.reason}"</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                      {it.saved
                        ? <span className="badge" style={{ background: 'var(--success, #5c9468)', color: '#fff' }}>✓ Uloženo (draft)</span>
                        : (
                          <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={!it.approved || it.generating} onClick={() => generateOne(it.key)}>
                            {it.generating ? 'Generuji…' : it.draft ? '↻ Znovu' : '🪄 AI generování'}
                          </button>
                        )}
                    </div>
                  </div>

                  {it.genError && <p style={{ marginTop: 10, fontSize: 12, color: 'var(--accent-dark, #b85a3e)' }}>⚠️ {it.genError}</p>}

                  {/* Editovatelná vygenerovaná data */}
                  {it.draft && !it.saved && (
                    <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        <Field l="Název CZ" v={it.draft.title} on={v => patchDraft(it.key, { title: v })} />
                        <Field l="Název EN" v={it.draft.title_en} on={v => patchDraft(it.key, { title_en: v })} />
                        <Field l="Název DE" v={it.draft.title_de} on={v => patchDraft(it.key, { title_de: v })} />
                      </div>
                      <Area l="Popis CZ" v={it.draft.description} on={v => patchDraft(it.key, { description: v })} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <Area l="Popis EN" v={it.draft.description_en} on={v => patchDraft(it.key, { description_en: v })} />
                        <Area l="Popis DE" v={it.draft.description_de} on={v => patchDraft(it.key, { description_de: v })} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                        <Field l="Datum (YYYY-MM-DD)" v={it.draft.event_date} on={v => patchDraft(it.key, { event_date: v })} />
                        <Field l="Rok od" v={it.draft.year_from} on={v => patchDraft(it.key, { year_from: v })} />
                        <Field l="Rok do" v={it.draft.year_to} on={v => patchDraft(it.key, { year_to: v })} />
                        <div>
                          <label className="label">Kategorie</label>
                          <select className="input" value={it.draft.category} onChange={e => patchDraft(it.key, { category: e.target.value })}>
                            <option value="">—</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <Field l="Lat" v={it.draft.lat} on={v => patchDraft(it.key, { lat: v })} />
                        <Field l="Lng" v={it.draft.lng} on={v => patchDraft(it.key, { lng: v })} />
                      </div>
                      <Area l="Prompt pro panorama (pro frontu / agenta)" v={it.draft.panorama_prompt} on={v => patchDraft(it.key, { panorama_prompt: v })} rows={4} mono />
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button className="btn btn-accent" style={{ fontSize: 13 }} disabled={it.saving} onClick={() => saveOne(it.key)}>
                          {it.saving ? 'Ukládám…' : '💾 Uložit jako draft'}
                        </button>
                        {it.saveError && <span style={{ fontSize: 12, color: 'var(--accent-dark, #b85a3e)' }}>⚠️ {it.saveError}</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ l, v, on }: { l: string; v: string; on: (v: string) => void }) {
  return (
    <div>
      <label className="label">{l}</label>
      <input className="input" value={v} onChange={e => on(e.target.value)} />
    </div>
  )
}

function Area({ l, v, on, rows = 2, mono }: { l: string; v: string; on: (v: string) => void; rows?: number; mono?: boolean }) {
  return (
    <div>
      <label className="label">{l}</label>
      <textarea className="input" value={v} onChange={e => on(e.target.value)} rows={rows}
        style={mono ? { fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.5 } : undefined} />
    </div>
  )
}
