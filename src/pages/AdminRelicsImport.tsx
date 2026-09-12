import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { slugify } from '@/lib/slugify'
import {
  RELIC_CATEGORIES, RARITY_ORDER,
  getCampaignBriefs, getAllRelicBriefs, upsertRelicForCampaign, uploadRelicModel, setRelicModelUrl,
  type CampaignBrief, type RelicBrief, type Rarity, type Relic,
} from '@/lib/relics'

// SheetJS (stejná konvence jako zbytek adminu)
async function loadXLSX(): Promise<any> {
  const w = window as any
  if (w.XLSX) return w.XLSX
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
    s.onload = () => resolve(); s.onerror = reject
    document.head.appendChild(s)
  })
  return (window as any).XLSX
}

// campaign_id + campaign se ve staženém souboru PŘEDVYPLNÍ (řádek na kampaň) —
// párování jde přes neměnné campaign_id, ne přes název. Ostatní sloupce vyplní admin.
const COLS = ['campaign_id', 'campaign', 'slug', 'name', 'name_en', 'name_de', 'year_label', 'category', 'secret', 'description', 'description_en', 'description_de'] as const

type ImportResult = { slug: string; name: string; ok: boolean; error?: string; campaign?: string }
type GlbResult = { file: string; ok: boolean; slug?: string; rarity?: Rarity; error?: string }

const truthy = (v: string) => ['ano', 'true', '1', 'yes', 'ano ', 'x'].includes(v.trim().toLowerCase())

export default function AdminRelicsImportPage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<CampaignBrief[]>([])
  const [relics, setRelics] = useState<RelicBrief[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [results, setResults] = useState<ImportResult[] | null>(null)
  const [glbResults, setGlbResults] = useState<GlbResult[] | null>(null)

  useEffect(() => { if (!loading && !isAdmin) navigate('/menu') }, [loading, isAdmin])

  const reloadRefs = useCallback(async () => {
    const [c, r] = await Promise.all([getCampaignBriefs(), getAllRelicBriefs()])
    setCampaigns(c); setRelics(r)
  }, [])
  useEffect(() => { reloadRefs() }, [reloadRefs])

  // ── Export šablony ──────────────────────────────────────
  async function downloadTemplate() {
    setMsg(null)
    const XLSX = await loadXLSX()
    if (!XLSX) { setMsg('Nepodařilo se načíst XLSX knihovnu.'); return }
    // Předvyplněný řádek na každou kampaň: campaign_id + název, zbytek prázdný k vyplnění.
    const rows = campaigns.map(c => [c.id, c.title, '', '', '', '', '', '', '', '', '', ''])
    const ws = XLSX.utils.aoa_to_sheet([[...COLS], ...rows])
    const help = [
      ['Nápověda k importu relikvií'],
      [''],
      ['Jak to funguje', 'Soubor má jeden řádek na každou existující kampaň. Vyplň relikvii jen u těch kampaní, kde ji chceš — prázdné řádky (bez name) se ignorují.'],
      [''],
      ['campaign_id', 'NEMĚNIT — technické ID kampaně (párování jede přes něj). Je předvyplněné.'],
      ['campaign', 'Jen pro tvou orientaci (název kampaně). Nepoužívá se k párování.'],
      ['slug', 'Slug relikvie (bez diakritiky, malá písmena, pomlčky). Prázdné = vytvoří se z názvu. Používá se pro názvy GLB souborů.'],
      ['name / name_en / name_de', 'Název relikvie CZ / EN / DE (EN, DE nepovinné — fallback na CZ).'],
      ['year_label', 'Datace jako text, např. „44 př. n. l." nebo „1800–1815".'],
      ['category', 'Jedna z: ' + RELIC_CATEGORIES.join(', ') + '.'],
      ['secret', 'Skrytá do dokončení kampaně? ano / ne.'],
      ['description / _en / _de', 'Popis CZ / EN / DE.'],
      [''],
      ['GLB modely', 'Po importu nahraj GLB soubory. Název = <slug-relikvie>_<rarita>.glb'],
      ['', 'Rarita = jedna z: ' + RARITY_ORDER.join(', ') + '. Příklad: napoleonuv-klobouk_epic.glb'],
    ]
    const wsHelp = XLSX.utils.aoa_to_sheet(help)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Relikvie')
    XLSX.utils.book_append_sheet(wb, wsHelp, 'Nápověda')
    XLSX.writeFile(wb, 'historyguessr_relikvie_sablona.xlsx')
  }

  // ── Import vyplněné šablony ─────────────────────────────
  async function importFile(file: File | null | undefined) {
    if (!file) return
    setBusy(true); setMsg(null); setResults(null); setGlbResults(null)
    try {
      const XLSX = await loadXLSX()
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
      const rows = data
        .map(r => { const o: Record<string, string> = {}; Object.entries(r).forEach(([k, v]) => { o[k.trim()] = String(v ?? '').trim() }); return o })
        .filter(r => r.name && r.name.trim())  // vyplňujeme jen řádky s názvem relikvie
      if (!rows.length) { setMsg('Nenašel jsem žádný řádek s vyplněným sloupcem „name".'); return }

      const byId = new Map(campaigns.map(c => [c.id, c]))
      const bySlug = new Map(campaigns.filter(c => c.slug).map(c => [c.slug as string, c]))
      const byTitle = new Map(campaigns.map(c => [c.title.trim().toLowerCase(), c]))
      const out: ImportResult[] = []
      for (const r of rows) {
        const name = r.name?.trim()
        const relicSlug = (r.slug?.trim() || slugify(name || '')).trim()
        // Párování: primárně přes neměnné campaign_id, jinak slug, jinak název (fallback)
        const camp = byId.get(r.campaign_id?.trim())
          || bySlug.get((r.campaign_slug || '').trim())
          || byTitle.get((r.campaign || '').trim().toLowerCase())
        if (!name) { out.push({ slug: relicSlug, name: name || '(bez názvu)', ok: false, error: 'Chybí name' }); continue }
        if (!camp) { out.push({ slug: relicSlug, name, ok: false, error: `Kampaň nenalezena (campaign_id „${r.campaign_id || '—'}")` }); continue }
        const cat = r.category?.trim().toLowerCase()
        const patch: Partial<Relic> = {
          slug: relicSlug,
          name,
          name_en: r.name_en?.trim() || null,
          name_de: r.name_de?.trim() || null,
          year_label: r.year_label?.trim() || null,
          category: cat && (RELIC_CATEGORIES as readonly string[]).includes(cat) ? cat : null,
          secret: truthy(r.secret || ''),
          description: r.description?.trim() || null,
          description_en: r.description_en?.trim() || null,
          description_de: r.description_de?.trim() || null,
        }
        const { error } = await upsertRelicForCampaign(camp.id, patch)
        out.push({ slug: relicSlug, name, ok: !error, error: error ?? undefined, campaign: camp.title })
      }
      setResults(out)
      await reloadRefs()
      const okN = out.filter(o => o.ok).length
      setMsg(`Import hotový: ${okN}/${out.length} relikvií uloženo.`)
    } catch (e) {
      setMsg('Nepodařilo se načíst soubor: ' + (e as Error).message)
    } finally { setBusy(false) }
  }

  // ── Hromadné nahrání GLB modelů ─────────────────────────
  async function uploadGlbs(files: FileList | null) {
    if (!files || !files.length) return
    setBusy(true); setMsg(null); setGlbResults(null)
    const bySlug = new Map(relics.map(r => [r.slug, r]))
    const rarSet = new Set<string>(RARITY_ORDER)
    const out: GlbResult[] = []
    for (const file of Array.from(files)) {
      const base = file.name.replace(/\.glb$/i, '')
      const us = base.lastIndexOf('_')
      const rarity = us >= 0 ? base.slice(us + 1).toLowerCase() : ''
      const relicSlug = us >= 0 ? base.slice(0, us) : ''
      if (!rarSet.has(rarity)) { out.push({ file: file.name, ok: false, error: 'Nerozpoznána rarita na konci názvu (…_common/rare/epic/legendary.glb)' }); continue }
      const relic = bySlug.get(relicSlug)
      if (!relic) { out.push({ file: file.name, ok: false, slug: relicSlug, rarity: rarity as Rarity, error: `Relikvie se slugem „${relicSlug}" nenalezena` }); continue }
      const { url, error } = await uploadRelicModel(file, relicSlug, rarity as Rarity)
      if (error || !url) { out.push({ file: file.name, ok: false, slug: relicSlug, rarity: rarity as Rarity, error: 'Upload selhal: ' + error }); continue }
      const { error: dbErr } = await setRelicModelUrl(relic.id, rarity as Rarity, url)
      out.push({ file: file.name, ok: !dbErr, slug: relicSlug, rarity: rarity as Rarity, error: dbErr ?? undefined })
    }
    setGlbResults(out)
    const okN = out.filter(o => o.ok).length
    setMsg(`GLB nahráno: ${okN}/${out.length} modelů.`)
    setBusy(false)
  }

  const box: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '18px 20px', marginBottom: 16 }
  const num: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, marginRight: 9 }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/admin')}>← Admin</button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, margin: 0 }}>🏺 Hromadný import relikvií</h1>
        {msg && <span style={{ marginLeft: 'auto', fontSize: 13, color: msg.includes('selhal') || msg.includes('prázdn') || msg.includes('Nepodařilo') ? 'var(--danger)' : 'var(--success-deep, #3f7a4d)' }}>{msg}</span>}
      </header>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '22px 20px 60px' }}>

        {/* Krok 1 — šablona */}
        <div style={box}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, margin: '0 0 6px' }}><span style={num}>1</span>Stáhni šablonu</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '0 0 12px', paddingLeft: 33 }}>XLSX má <b>předvyplněný řádek pro každou z {campaigns.length} kampaní</b> (sloupce <code>campaign_id</code> + <code>campaign</code>). Vyplníš jen data relikvií u kampaní, kde je chceš.</p>
          <div style={{ paddingLeft: 33 }}><button className="btn btn-accent" onClick={downloadTemplate}>⬇ Stáhnout šablonu (XLSX)</button></div>
        </div>

        {/* Krok 2 — nahraj vyplněnou */}
        <div style={box}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, margin: '0 0 6px' }}><span style={num}>2</span>Nahraj vyplněnou šablonu</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '0 0 12px', paddingLeft: 33 }}>Relikvie se založí/aktualizují a spárují přes <code>campaign_id</code> (1 relikvie na kampaň). Prázdné řádky bez <code>name</code> se přeskočí.</p>
          <div style={{ paddingLeft: 33 }}>
            <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>{busy ? 'Zpracovávám…' : 'Vybrat XLSX soubor'}<input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} disabled={busy} onChange={e => importFile(e.target.files?.[0])}/></label>
          </div>
          {results && (
            <div style={{ marginTop: 14, paddingLeft: 33 }}>
              {results.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '4px 0', color: r.ok ? 'var(--ink-2)' : 'var(--danger)' }}>
                  <span>{r.ok ? '✓' : '✕'}</span>
                  <b style={{ color: 'var(--ink)' }}>{r.name}</b>
                  <code style={{ color: 'var(--ink-3)' }}>{r.slug}</code>
                  {r.campaign && <span style={{ color: 'var(--ink-3)' }}>· {r.campaign}</span>}
                  {r.error && <span>— {r.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Krok 3 — GLB modely */}
        <div style={box}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, margin: '0 0 6px' }}><span style={num}>3</span>Nahraj GLB modely (více najednou)</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '0 0 12px', paddingLeft: 33 }}>
            Název souboru: <code>&lt;slug-relikvie&gt;_&lt;rarita&gt;.glb</code> — rarita <b>{RARITY_ORDER.join(' / ')}</b>.<br/>
            Např. <code>napoleonuv-klobouk_common.glb</code>, <code>…_rare.glb</code>, <code>…_epic.glb</code>, <code>…_legendary.glb</code> naráz.
          </p>
          <div style={{ paddingLeft: 33 }}>
            <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>{busy ? 'Nahrávám…' : 'Vybrat GLB soubory'}<input type="file" accept=".glb" multiple style={{ display: 'none' }} disabled={busy} onChange={e => uploadGlbs(e.target.files)}/></label>
          </div>
          {glbResults && (
            <div style={{ marginTop: 14, paddingLeft: 33 }}>
              {glbResults.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '4px 0', color: r.ok ? 'var(--ink-2)' : 'var(--danger)' }}>
                  <span>{r.ok ? '✓' : '✕'}</span>
                  <code style={{ color: 'var(--ink)' }}>{r.file}</code>
                  {r.rarity && <span style={{ color: 'var(--ink-3)' }}>· {r.rarity}</span>}
                  {r.error && <span>— {r.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
