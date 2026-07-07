import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { formatYear } from '@/lib/scoring'
import {
  getAdminEvents,
  getAdminCampaignCategories, createCampaignCategory, updateCampaignCategory, deleteCampaignCategory,
  getAdminCampaigns, createCampaign, updateCampaign, deleteCampaign,
  getCampaignEvents, setCampaignEvents,
} from '@/lib/supabase'
import type { CampaignCategory, Campaign, Event } from '@/types/database'

// Předvyplněný práh ★ pro novou kategorii dle pořadí: round(0.7·(k−1)·k)
function defaultUnlockStars(index0: number): number {
  const k = index0 + 1
  return Math.round(0.7 * (k - 1) * k)
}

type View =
  | { mode: 'list' }
  | { mode: 'category'; categoryId: string }

export default function AdminCampaignsPage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<View>({ mode: 'list' })
  const [categories, setCategories] = useState<CampaignCategory[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => { if (!loading && !isAdmin) navigate('/menu') }, [loading, isAdmin])

  const reloadCategories = useCallback(async () => {
    setCategories(await getAdminCampaignCategories())
  }, [])

  useEffect(() => {
    async function load() {
      setLoadingData(true)
      const [cats, evRes] = await Promise.all([
        getAdminCampaignCategories(),
        getAdminEvents().then(r => (r.data ?? []) as Event[]),
      ])
      setCategories(cats)
      setEvents(evRes.filter(e => e.published))
      setLoadingData(false)
    }
    load()
  }, [])

  if (loadingData) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-200)' }}><span className="spinner"/></div>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/admin')}>← Admin</button>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>🏛 Kampaně</h1>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '2px 0 0' }}>{categories.length} kategorií · odemykání za ★</p>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
        {view.mode === 'list' && (
          <CategoryList
            categories={categories}
            onOpen={(id) => setView({ mode: 'category', categoryId: id })}
            onReload={reloadCategories}
          />
        )}
        {view.mode === 'category' && (
          <CategoryDetail
            category={categories.find(c => c.id === view.categoryId)!}
            events={events}
            onBack={() => setView({ mode: 'list' })}
            onReloadCategories={reloadCategories}
          />
        )}
      </div>
    </div>
  )
}

// ═══════════════════ Seznam kategorií ═══════════════════
function CategoryList({ categories, onOpen, onReload }: {
  categories: CampaignCategory[]
  onOpen: (id: string) => void
  onReload: () => Promise<void>
}) {
  const [editing, setEditing] = useState<CampaignCategory | 'new' | null>(null)
  const [busy, setBusy] = useState(false)

  async function move(cat: CampaignCategory, dir: -1 | 1) {
    const sorted = [...categories]
    const i = sorted.findIndex(c => c.id === cat.id)
    const j = i + dir
    if (j < 0 || j >= sorted.length) return
    setBusy(true)
    await Promise.all([
      updateCampaignCategory(sorted[i].id, { seq: sorted[j].seq }),
      updateCampaignCategory(sorted[j].id, { seq: sorted[i].seq }),
    ])
    await onReload(); setBusy(false)
  }

  async function remove(cat: CampaignCategory) {
    if (!confirm(`Smazat kategorii „${cat.title}" včetně všech jejích kampaní?`)) return
    setBusy(true)
    await deleteCampaignCategory(cat.id)
    await onReload(); setBusy(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p className="eyebrow" style={{ margin: 0 }}>Kategorie</p>
        <button className="btn btn-accent" style={{ fontSize: 13 }} onClick={() => setEditing('new')}>+ Nová kategorie</button>
      </div>

      {categories.length === 0 && (
        <p style={{ color: 'var(--ink-3)', fontSize: 14, padding: '20px 0' }}>Zatím žádné kategorie. Přidej první.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {categories.map((cat, i) => (
          <div key={cat.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 26, width: 34, textAlign: 'center' }}>{cat.icon || '📁'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)' }}>{cat.title}</span>
                <span className="badge" style={{ background: 'var(--paper-200)', color: 'var(--ink-2)', fontSize: 11 }}>⭐ {cat.unlock_stars}</span>
                {cat.is_premium && <span className="badge" style={{ background: 'rgba(245,206,139,0.3)', color: 'var(--accent-deep)', fontSize: 11 }}>PREMIUM</span>}
                <span className="badge" style={{ background: cat.published ? 'rgba(92,148,104,0.18)' : 'var(--paper-200)', color: cat.published ? '#3f7a4d' : 'var(--ink-3)', fontSize: 11 }}>{cat.published ? 'Publikováno' : 'Skryté'}</span>
              </div>
              {cat.description && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.description}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <button className="btn btn-ghost" style={iconBtn} disabled={busy || i === 0} onClick={() => move(cat, -1)} title="Nahoru">↑</button>
              <button className="btn btn-ghost" style={iconBtn} disabled={busy || i === categories.length - 1} onClick={() => move(cat, 1)} title="Dolů">↓</button>
              <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setEditing(cat)}>Upravit</button>
              <button className="btn btn-accent" style={{ fontSize: 13 }} onClick={() => onOpen(cat.id)}>Kampaně →</button>
              <button className="btn btn-ghost" style={{ ...iconBtn, color: '#c0392b' }} disabled={busy} onClick={() => remove(cat)} title="Smazat">✕</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <CategoryForm
          category={editing === 'new' ? null : editing}
          defaultSeq={editing === 'new' ? ((categories.length ? categories[categories.length - 1].seq : 0) + 1) : undefined}
          defaultUnlock={editing === 'new' ? defaultUnlockStars(categories.length) : undefined}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await onReload() }}
        />
      )}
    </div>
  )
}

// ═══════════════════ Formulář kategorie ═══════════════════
function CategoryForm({ category, defaultSeq, defaultUnlock, onClose, onSaved }: {
  category: CampaignCategory | null
  defaultSeq?: number
  defaultUnlock?: number
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [f, setF] = useState({
    title: category?.title ?? '',
    title_en: category?.title_en ?? '',
    title_de: category?.title_de ?? '',
    description: category?.description ?? '',
    icon: category?.icon ?? '',
    color: category?.color ?? '#BE6240',
    unlock_stars: String(category?.unlock_stars ?? defaultUnlock ?? 0),
    is_premium: category?.is_premium ?? false,
    published: category?.published ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: any) => setF(s => ({ ...s, [k]: v }))

  async function save() {
    if (!f.title.trim()) { setErr('Vyplň název.'); return }
    setSaving(true); setErr(null)
    const patch: Partial<CampaignCategory> = {
      title: f.title.trim(),
      title_en: f.title_en.trim() || null,
      title_de: f.title_de.trim() || null,
      description: f.description.trim() || null,
      icon: f.icon.trim() || null,
      color: f.color || null,
      unlock_stars: parseInt(f.unlock_stars) || 0,
      is_premium: f.is_premium,
      published: f.published,
    }
    const res = category
      ? await updateCampaignCategory(category.id, patch)
      : await createCampaignCategory({ ...patch, seq: defaultSeq ?? 0 })
    setSaving(false)
    if (res.error) { setErr(res.error.message); return }
    await onSaved()
  }

  return (
    <Modal title={category ? 'Upravit kategorii' : 'Nová kategorie'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Název (CZ)"><input className="input" value={f.title} onChange={e => set('title', e.target.value)} autoFocus/></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Název (EN)"><input className="input" value={f.title_en} onChange={e => set('title_en', e.target.value)}/></Field>
          <Field label="Název (DE)"><input className="input" value={f.title_de} onChange={e => set('title_de', e.target.value)}/></Field>
        </div>
        <Field label="Popis"><textarea className="input" rows={2} value={f.description} onChange={e => set('description', e.target.value)}/></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr', gap: 12 }}>
          <Field label="Ikona"><input className="input" value={f.icon} onChange={e => set('icon', e.target.value)} placeholder="👑"/></Field>
          <Field label="Barva"><input type="color" value={f.color} onChange={e => set('color', e.target.value)} style={{ width: '100%', height: 40, border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer' }}/></Field>
          <Field label="Odemknout za ★ (globální)"><input className="input" type="number" min={0} value={f.unlock_stars} onChange={e => set('unlock_stars', e.target.value)}/></Field>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 2 }}>
          <label style={checkLabel}><input type="checkbox" checked={f.is_premium} onChange={e => set('is_premium', e.target.checked)}/> Premium</label>
          <label style={checkLabel}><input type="checkbox" checked={f.published} onChange={e => set('published', e.target.checked)}/> Publikováno</label>
        </div>
        {err && <div className="alert alert-error">⚠ {err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn btn-ghost" onClick={onClose}>Zrušit</button>
          <button className="btn btn-accent" disabled={saving} onClick={save}>{saving ? 'Ukládám…' : 'Uložit'}</button>
        </div>
      </div>
    </Modal>
  )
}

// ═══════════════════ Detail kategorie (kampaně) ═══════════════════
function CategoryDetail({ category, events, onBack, onReloadCategories }: {
  category: CampaignCategory
  events: Event[]
  onBack: () => void
  onReloadCategories: () => Promise<void>
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [editing, setEditing] = useState<Campaign | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadingC, setLoadingC] = useState(true)

  const reload = useCallback(async () => {
    const list = await getAdminCampaigns(category.id)
    setCampaigns(list)
    // spočítej počet událostí na kampaň
    const entries = await Promise.all(list.map(async c => [c.id, (await getCampaignEvents(c.id)).length] as const))
    setCounts(Object.fromEntries(entries))
    setLoadingC(false)
  }, [category.id])

  useEffect(() => { reload() }, [reload])

  async function move(c: Campaign, dir: -1 | 1) {
    const i = campaigns.findIndex(x => x.id === c.id)
    const j = i + dir
    if (j < 0 || j >= campaigns.length) return
    setBusy(true)
    await Promise.all([
      updateCampaign(campaigns[i].id, { seq: campaigns[j].seq }),
      updateCampaign(campaigns[j].id, { seq: campaigns[i].seq }),
    ])
    await reload(); setBusy(false)
  }

  async function remove(c: Campaign) {
    if (!confirm(`Smazat kampaň „${c.title}"?`)) return
    setBusy(true); await deleteCampaign(c.id); await reload(); setBusy(false)
  }

  return (
    <div>
      <button className="btn btn-ghost" style={{ fontSize: 13, marginBottom: 14 }} onClick={onBack}>← Kategorie</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span style={{ fontSize: 30 }}>{category.icon || '📁'}</span>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, margin: 0 }}>{category.title}</h2>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '2px 0 0' }}>Odemyká se za ⭐ {category.unlock_stars} · {campaigns.length} kampaní</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p className="eyebrow" style={{ margin: 0 }}>Kampaně</p>
        <button className="btn btn-accent" style={{ fontSize: 13 }} onClick={() => setEditing('new')}>+ Nová kampaň</button>
      </div>

      {loadingC ? <span className="spinner"/> : campaigns.length === 0 ? (
        <p style={{ color: 'var(--ink-3)', fontSize: 14, padding: '16px 0' }}>Zatím žádné kampaně.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {campaigns.map((c, i) => {
            const n = counts[c.id] ?? 0
            return (
              <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)', width: 22 }}>#{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>{c.title}</span>
                    <span className="badge" style={{ background: n === 5 ? 'rgba(92,148,104,0.18)' : 'rgba(217,119,87,0.12)', color: n === 5 ? '#3f7a4d' : 'var(--accent-deep)', fontSize: 11 }}>{n}/5 událostí</span>
                    <span className="badge" style={{ background: 'var(--paper-200)', color: 'var(--ink-2)', fontSize: 11 }}>⭐ {c.unlock_stars}</span>
                    <span className="badge" style={{ background: c.published ? 'rgba(92,148,104,0.18)' : 'var(--paper-200)', color: c.published ? '#3f7a4d' : 'var(--ink-3)', fontSize: 11 }}>{c.published ? 'Publikováno' : 'Skryté'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-ghost" style={iconBtn} disabled={busy || i === 0} onClick={() => move(c, -1)}>↑</button>
                  <button className="btn btn-ghost" style={iconBtn} disabled={busy || i === campaigns.length - 1} onClick={() => move(c, 1)}>↓</button>
                  <button className="btn btn-accent" style={{ fontSize: 13 }} onClick={() => setEditing(c)}>Upravit</button>
                  <button className="btn btn-ghost" style={{ ...iconBtn, color: '#c0392b' }} disabled={busy} onClick={() => remove(c)}>✕</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <CampaignForm
          category={category}
          campaign={editing === 'new' ? null : editing}
          defaultSeq={editing === 'new' ? ((campaigns.length ? campaigns[campaigns.length - 1].seq : 0) + 1) : undefined}
          events={events}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await reload(); await onReloadCategories() }}
        />
      )}
    </div>
  )
}

// ═══════════════════ Formulář kampaně + picker 5 událostí ═══════════════════
function CampaignForm({ category, campaign, defaultSeq, events, onClose, onSaved }: {
  category: CampaignCategory
  campaign: Campaign | null
  defaultSeq?: number
  events: Event[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [f, setF] = useState({
    title: campaign?.title ?? '',
    title_en: campaign?.title_en ?? '',
    title_de: campaign?.title_de ?? '',
    description: campaign?.description ?? '',
    unlock_stars: String(campaign?.unlock_stars ?? 0),
    published: campaign?.published ?? false,
  })
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null, null])
  const [pickSlot, setPickSlot] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: any) => setF(s => ({ ...s, [k]: v }))
  const eventById = new Map(events.map(e => [e.id, e]))

  useEffect(() => {
    if (!campaign) return
    getCampaignEvents(campaign.id).then(rows => {
      const arr: (string | null)[] = [null, null, null, null, null]
      for (const r of rows) if (r.position >= 1 && r.position <= 5) arr[r.position - 1] = r.event_id
      setSlots(arr)
    })
  }, [campaign])

  const filled = slots.filter(Boolean) as string[]

  async function save() {
    if (!f.title.trim()) { setErr('Vyplň název kampaně.'); return }
    if (f.published && filled.length !== 5) { setErr('Pro publikování musí mít kampaň všech 5 událostí.'); return }
    setSaving(true); setErr(null)
    const patch: Partial<Campaign> = {
      category_id: category.id,
      title: f.title.trim(),
      title_en: f.title_en.trim() || null,
      title_de: f.title_de.trim() || null,
      description: f.description.trim() || null,
      unlock_stars: parseInt(f.unlock_stars) || 0,
      published: f.published,
    }
    let campaignId = campaign?.id
    if (campaign) {
      const { error } = await updateCampaign(campaign.id, patch)
      if (error) { setSaving(false); setErr(error.message); return }
    } else {
      const { data, error } = await createCampaign({ ...patch, seq: defaultSeq ?? 0 })
      if (error || !data) { setSaving(false); setErr(error?.message ?? 'Nepodařilo se vytvořit.'); return }
      campaignId = (data as Campaign).id
    }
    // ulož 5-tici (komprimuje na vyplněné v pořadí slotů)
    const ordered = slots.filter(Boolean) as string[]
    const { error: evErr } = await setCampaignEvents(campaignId!, ordered)
    setSaving(false)
    if (evErr) { setErr('Kampaň uložena, ale události se nepodařilo uložit: ' + evErr.message); return }
    await onSaved()
  }

  return (
    <Modal title={campaign ? 'Upravit kampaň' : 'Nová kampaň'} onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Název kampaně (CZ)"><input className="input" value={f.title} onChange={e => set('title', e.target.value)} autoFocus/></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Název (EN)"><input className="input" value={f.title_en} onChange={e => set('title_en', e.target.value)}/></Field>
          <Field label="Název (DE)"><input className="input" value={f.title_de} onChange={e => set('title_de', e.target.value)}/></Field>
        </div>
        <Field label="Popis"><textarea className="input" rows={2} value={f.description} onChange={e => set('description', e.target.value)}/></Field>
        <Field label="Odemknout za ★ (v rámci kategorie)"><input className="input" type="number" min={0} value={f.unlock_stars} onChange={e => set('unlock_stars', e.target.value)} style={{ maxWidth: 160 }}/></Field>

        {/* 5 slotů událostí */}
        <div>
          <label className="label">Události ({filled.length}/5)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {slots.map((eid, i) => {
              const ev = eid ? eventById.get(eid) : null
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--paper-100)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)', width: 20 }}>{i + 1}.</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {ev ? (
                      <>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{formatYear(ev.year)}{ev.category && ` · ${ev.category}`}</div>
                      </>
                    ) : eid ? (
                      <span style={{ fontSize: 12.5, color: '#c0392b' }}>⚠ Událost není publikovaná / smazaná</span>
                    ) : (
                      <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>— prázdné —</span>
                    )}
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setPickSlot(i)}>{ev ? 'Změnit' : 'Vybrat'}</button>
                  {eid && <button className="btn btn-ghost" style={{ ...iconBtn, color: '#c0392b' }} onClick={() => setSlots(s => s.map((x, k) => k === i ? null : x))}>✕</button>}
                </div>
              )
            })}
          </div>
        </div>

        {err && <div className="alert alert-error">⚠ {err}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <label style={checkLabel}><input type="checkbox" checked={f.published} onChange={e => set('published', e.target.checked)}/> Publikováno</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>Zrušit</button>
            <button className="btn btn-accent" disabled={saving} onClick={save}>{saving ? 'Ukládám…' : 'Uložit'}</button>
          </div>
        </div>
      </div>

      {pickSlot !== null && (
        <EventPicker
          events={events}
          usedIds={new Set(slots.filter((x, k) => x && k !== pickSlot) as string[])}
          onPick={(id) => { setSlots(s => s.map((x, k) => k === pickSlot ? id : x)); setPickSlot(null) }}
          onClose={() => setPickSlot(null)}
        />
      )}
    </Modal>
  )
}

// ═══════════════════ Picker události ═══════════════════
function EventPicker({ events, usedIds, onPick, onClose }: {
  events: Event[]
  usedIds: Set<string>
  onPick: (id: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const q = search.toLowerCase()
  const filtered = events.filter(e =>
    e.title.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(42,31,23,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: 'var(--shadow-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, margin: 0 }}>Vybrat událost</h3>
        </div>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)' }}>
          <input className="input" placeholder="Hledat událost…" value={search} onChange={e => setSearch(e.target.value)} autoFocus/>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {filtered.length === 0 && <p style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Nic nenalezeno</p>}
          {filtered.map(ev => {
            const used = usedIds.has(ev.id)
            return (
              <button key={ev.id} disabled={used} onClick={() => onPick(ev.id)}
                style={{ width: '100%', padding: '10px 20px', border: 'none', background: 'transparent', textAlign: 'left', cursor: used ? 'not-allowed' : 'pointer', opacity: used ? 0.4 : 1 }}
                onMouseEnter={e => { if (!used) (e.currentTarget as HTMLButtonElement).style.background = 'var(--paper-100)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{ev.title}{used && ' · již v kampani'}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{formatYear(ev.year)}{ev.category && ` · ${ev.category}`}</div>
              </button>
            )
          })}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)' }}>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onClose}>Zrušit</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════ Sdílené UI ═══════════════════
function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(42,31,23,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: wide ? 620 : 480, boxShadow: 'var(--shadow-xl)', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, margin: 0 }}>{title}</h3>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>
}

const iconBtn: React.CSSProperties = { fontSize: 13, padding: '6px 9px', minWidth: 0 }
const checkLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }
