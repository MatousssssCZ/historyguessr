import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { eventTitle } from '@/lib/eventLocale'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  getCandidateEvents, getMyEntitlements, getMyPresets, createPreset, updatePreset,
  deletePreset, setPresetShared, getMyMistakeEventIds, getMyPlayedEventIds, getSharedPreset,
  type CandidateEvent,
} from '@/lib/supabase'
import { singlePlayerCapabilities, isPremiumUser, FREE_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements'
import { singlePlayerAnalytics, monetizationAnalytics } from '@/lib/analytics'
import type { SinglePlayerPreset, PresetRules } from '@/lib/presets'
import { formatYear } from '@/lib/scoring'
import YearRange, { YEAR_MIN, YEAR_MAX } from '@/components/YearRange'
import { Segmented, CategoryChips, CATEGORY_IDS as CAT_IDS } from '@/components/GameSettings'
import { useIsMobile } from '@/hooks/useIsMobile'
import { PageHeader } from '@/components/ui/Page'
import AppHeader from '@/components/AppHeader'
import type { GameOptions } from '@/hooks/useGame'

const ROUND_OPTIONS = [3, 5, 10]

// Rychlé předvolby období (chipy). „Vlastní" = cokoli mimo tyto rozsahy.
const ERAS: { key: string; from: number; to: number }[] = [
  { key: 'eraAll', from: YEAR_MIN, to: YEAR_MAX },
  { key: 'eraAntiquity', from: -3000, to: 500 },
  { key: 'eraMedieval', from: 500, to: 1500 },
  { key: 'era20', from: 1900, to: 2000 },
]

type SortBy = 'year' | 'title'

export default function PreGameLobbyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [rounds, setRounds] = useState(5)
  const [categories, setCategories] = useState<string[]>([])
  const [yearFrom, setYearFrom] = useState(YEAR_MIN)
  const [yearTo, setYearTo] = useState(YEAR_MAX)

  const [candidates, setCandidates] = useState<CandidateEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('year')
  const [search, setSearch] = useState('')
  const [catCounts, setCatCounts] = useState<Record<string, number>>({})

  // Počty událostí po kategoriích v aktuálním rozsahu let (nezávisle na výběru kategorií)
  useEffect(() => {
    let alive = true
    const lo = Math.min(yearFrom, yearTo), hi = Math.max(yearFrom, yearTo)
    getCandidateEvents({ categories: [], yearFrom: lo, yearTo: hi })
      .then(list => {
        if (!alive) return
        const m: Record<string, number> = {}
        for (const e of list) if (e.category) m[e.category] = (m[e.category] ?? 0) + 1
        setCatCounts(m)
      }).catch(() => {})
    return () => { alive = false }
  }, [yearFrom, yearTo])

  // Desktop dostává vlastní, přehlednější dvousloupcový layout
  const isMobile = useIsMobile()

  // ── Free / Premium (autorita je server; tohle řídí jen UI) ──
  const { user } = useAuth()
  const [ent, setEnt] = useState<Entitlements>(FREE_ENTITLEMENTS)
  useEffect(() => { getMyEntitlements().then(setEnt).catch(() => {}) }, [user?.id])
  const caps = singlePlayerCapabilities(ent)
  const isPremium = isPremiumUser(ent)

  // ── Premium filtry ──
  const [onlyUnplayed, setOnlyUnplayed] = useState(false)
  const [onlyMistakes, setOnlyMistakes] = useState(false)
  const [smartIds, setSmartIds] = useState<{ played: string[]; mistakes: string[] }>({ played: [], mistakes: [] })
  useEffect(() => {
    if (!caps.canUseSmartFilters) return
    Promise.all([getMyPlayedEventIds(), getMyMistakeEventIds()])
      .then(([played, mistakes]) => setSmartIds({ played, mistakes }))
      .catch(() => {})
  }, [caps.canUseSmartFilters])

  // ── Scénáře ──
  const [presets, setPresets] = useState<SinglePlayerPreset[]>([])
  const [presetMsg, setPresetMsg] = useState<string | null>(null)
  const reloadPresets = useCallback(() => {
    if (!caps.canSavePresets) return
    getMyPresets().then(setPresets).catch(() => {})
  }, [caps.canSavePresets])
  useEffect(() => { reloadPresets() }, [reloadPresets])

  // Sdílený scénář z odkazu (?preset=slug) — načte se komukoli, i Free.
  // Přes ref, ať efekt nevolá zastaralou closure applyRules.
  const applyRulesRef = useRef<(r: PresetRules) => void>(() => {})
  const [searchParams] = useSearchParams()
  const sharedSlug = searchParams.get('preset')
  useEffect(() => {
    if (!sharedSlug) return
    getSharedPreset(sharedSlug).then(p => {
      if (!p) { setPresetMsg(t('pregame.sharedNotFound')); return }
      applyRulesRef.current(p.rules)
      setPresetMsg(t('pregame.sharedLoaded', { name: p.name, by: p.owner_name ? t('pregame.sharedBy', { name: p.owner_name }) : '' }))
    }).catch(() => setPresetMsg(t('pregame.sharedLoadFailed')))
  }, [sharedSlug])

  // Načti kandidáty při změně filtrů
  useEffect(() => {
    let alive = true
    setLoading(true)
    const lo = Math.min(yearFrom, yearTo)
    const hi = Math.max(yearFrom, yearTo)
    getCandidateEvents({ categories, yearFrom: lo, yearTo: hi })
      .then(list => {
        if (!alive) return
        setCandidates(list)
        // Zahoď vyloučení, které už neodpovídá filtru
        setExcluded(prev => {
          const ids = new Set(list.map(e => e.id))
          const next = new Set<string>()
          prev.forEach(id => { if (ids.has(id)) next.add(id) })
          return next
        })
        setLoading(false)
      })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [categories, yearFrom, yearTo])

  // Premium chytré filtry zúží kandidáty (Free je nemá → prázdné množiny)
  const filteredCandidates = useMemo(() => {
    let arr = candidates
    if (onlyUnplayed && caps.canUseSmartFilters) {
      const played = new Set(smartIds.played)
      arr = arr.filter(e => !played.has(e.id))
    }
    if (onlyMistakes && caps.canUseSmartFilters) {
      const bad = new Set(smartIds.mistakes)
      arr = arr.filter(e => bad.has(e.id))
    }
    return arr
  }, [candidates, onlyUnplayed, onlyMistakes, smartIds, caps.canUseSmartFilters])

  const sortedCandidates = useMemo(() => {
    const arr = [...filteredCandidates]
    if (sortBy === 'year') arr.sort((a, b) => a.year - b.year)
    else arr.sort((a, b) => eventTitle({ ...a, description: '' }).localeCompare(eventTitle({ ...b, description: '' })))
    return arr
  }, [filteredCandidates, sortBy])

  const displayCandidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sortedCandidates
    return sortedCandidates.filter(e => eventTitle({ ...e, description: '' }).toLowerCase().includes(q))
  }, [sortedCandidates, search])

  const lo = Math.min(yearFrom, yearTo), hi = Math.max(yearFrom, yearTo)
  const activeEra = ERAS.find(e => e.from === lo && e.to === hi)?.key ?? 'eraCustom'

  const activeIds = useMemo(() => new Set(filteredCandidates.map(e => e.id)), [filteredCandidates])
  const excludedActive = [...excluded].filter(id => activeIds.has(id))
  const availableCount = filteredCandidates.length - excludedActive.length
  const enough = availableCount >= rounds

  function toggleCategory(id: string) {
    setCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }
  const excludeLimit = caps.excludeLimit  // null = neomezeně (Premium)
  const excludeFull = excludeLimit !== null && excluded.size >= excludeLimit

  function toggleExclude(id: string) {
    setExcluded(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); return next }
      // Free má strop; Premium neomezeně (funkce se NEodebírá, jen rozšiřuje)
      if (excludeLimit !== null && next.size >= excludeLimit) {
        monetizationAnalytics.premiumFeatureAttempt('unlimitedExclude', user?.id)
        singlePlayerAnalytics.premiumFilterAttempt('unlimitedExclude', user?.id)
        setPresetMsg(t('pregame.excludeLimit', { n: excludeLimit }))
        return prev
      }
      next.add(id)
      return next
    })
  }

  /** Aktuální nastavení jako pravidla scénáře. */
  function currentRules(): PresetRules {
    return {
      rounds,
      categories,
      yearFrom: Math.min(yearFrom, yearTo),
      yearTo: Math.max(yearFrom, yearTo),
      excludeIds: [...excluded],
      onlyUnplayed, onlyMistakes,
    }
  }

  applyRulesRef.current = applyRules
  function applyRules(r: PresetRules) {
    setRounds(r.rounds)
    setCategories(r.categories)
    setYearFrom(r.yearFrom); setYearTo(r.yearTo)
    setExcluded(new Set(r.excludeIds))
    setOnlyUnplayed(!!r.onlyUnplayed && caps.canUseSmartFilters)
    setOnlyMistakes(!!r.onlyMistakes && caps.canUseSmartFilters)
  }

  function start() {
    if (!enough) return
    if (categories.length) singlePlayerAnalytics.filterUsed('categories', categories, user?.id)
    if (excluded.size) singlePlayerAnalytics.filterUsed('excludeEvents', excluded.size, user?.id)
    if (onlyUnplayed) singlePlayerAnalytics.filterUsed('onlyUnplayed', true, user?.id)
    if (onlyMistakes) singlePlayerAnalytics.filterUsed('onlyMistakes', true, user?.id)

    // Chytré filtry se do hry promítnou jako vyloučení (getRandomEvents umí excludeIds)
    const outOfScope = onlyUnplayed || onlyMistakes
      ? candidates.filter(e => !activeIds.has(e.id)).map(e => e.id)
      : []
    const options: GameOptions = {
      rounds,
      categories,
      yearFrom: Math.min(yearFrom, yearTo),
      yearTo: Math.max(yearFrom, yearTo),
      excludeIds: [...new Set([...excluded, ...outOfScope])],
    }
    navigate('/game', { state: options })
  }

  // ── Sdílené ovládací fragmenty (mobil i desktop) ──────────
  const roundsCtl = (
    <Segmented value={rounds} options={ROUND_OPTIONS.map(r => ({ v: r, label: String(r) }))} onChange={setRounds}/>
  )

  const categoriesCtl = <CategoryChips selected={categories} onToggle={toggleCategory}/>

  const yearCtl = <YearRange from={yearFrom} to={yearTo} onFrom={setYearFrom} onTo={setYearTo}/>

  const smartCtl = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <SmartFilterChip
        label={t('pregame.onlyUnplayed')} on={onlyUnplayed} enabled={caps.canUseSmartFilters}
        onClick={() => {
          if (!caps.canUseSmartFilters) {
            singlePlayerAnalytics.premiumFilterAttempt('onlyUnplayed', user?.id)
            monetizationAnalytics.upsellShown('premium_single_player_feature', user?.id)
            setPresetMsg(t('pregame.lockUnplayed'))
            return
          }
          setOnlyUnplayed(v => !v)
        }}/>
      <SmartFilterChip
        label={t('pregame.onlyMistakes')} on={onlyMistakes} enabled={caps.canUseSmartFilters}
        onClick={() => {
          if (!caps.canUseSmartFilters) {
            singlePlayerAnalytics.premiumFilterAttempt('onlyMistakes', user?.id)
            monetizationAnalytics.upsellShown('premium_single_player_feature', user?.id)
            setPresetMsg(t('pregame.lockMistakes'))
            return
          }
          setOnlyMistakes(v => !v)
        }}/>
    </div>
  )

  const presetsCtl = (
    <>
      <PresetBar
        presets={presets} canUse={caps.canSavePresets} canShare={caps.canSharePresets}
        userId={user?.id}
        onLoad={(r) => { applyRules(r); setPresetMsg(t('pregame.presetLoaded')) }}
        onSave={async (name) => {
          if (!user) return
          const { data } = await createPreset(user.id, name, currentRules())
          if (data) singlePlayerAnalytics.presetCreated((data as { id: string }).id, user.id)
          setPresetMsg(t('pregame.presetSaved')); reloadPresets()
        }}
        onOverwrite={async (p) => {
          await updatePreset(p.id, { rules: currentRules() })
          setPresetMsg(t('pregame.presetOverwritten')); reloadPresets()
        }}
        onDuplicate={async (p) => {
          if (!user) return
          await createPreset(user.id, `${p.name} (kopie)`, p.rules)
          setPresetMsg(t('pregame.presetDuplicated')); reloadPresets()
        }}
        onDelete={async (p) => {
          if (!confirm(t('pregame.presetDeleteConfirm', { name: p.name }))) return
          await deletePreset(p.id); setPresetMsg(t('pregame.presetDeleted')); reloadPresets()
        }}
        onShare={async (p) => {
          try {
            const slug = await setPresetShared(p.id, !p.is_shared)
            if (slug) {
              const url = `${window.location.origin}/play?preset=${slug}`
              await navigator.clipboard?.writeText(url).catch(() => {})
              singlePlayerAnalytics.presetShared(p.id, user?.id)
              setPresetMsg(t('pregame.linkCopied'))
            } else setPresetMsg(t('pregame.sharingOff'))
            reloadPresets()
          } catch { setPresetMsg(t('pregame.shareFailed')) }
        }}
        onPremium={() => {
          monetizationAnalytics.upsellShown('premium_single_player_feature', user?.id)
          setPresetMsg(t('pregame.presetsPremium'))
        }}
      />
      {presetMsg && (
        <div style={{ fontSize: 12.5, color: 'var(--accent-deep)', marginTop: 8 }}>{presetMsg}</div>
      )}
    </>
  )

  const counterCtl = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 12,
      padding: '11px 14px', borderRadius: 11,
      background: enough ? 'var(--success-soft)' : 'rgba(192,57,43,0.08)',
      color: enough ? 'var(--success-deep)' : 'var(--danger)',
    }}>
      {loading ? '…' : enough
        ? <><span>✓</span> {t('pregame.inGame', { count: availableCount })}{excluded.size > 0 && <span style={{ color: 'var(--ink-3)' }}> · {t('pregame.excluded', { n: excluded.size })}</span>}</>
        : <><span>⚠</span> {t('pregame.notEnough', { n: availableCount, min: rounds })}</>}
    </div>
  )

  // Scrollovatelné tělo seznamu událostí (sdílené mobil/desktop)
  const eventListBody = (
      <div style={{ maxHeight: isMobile ? 320 : 380, overflowY: 'auto', borderTop: '1px solid var(--line)' }}>
        {loading && <div style={{ padding: 16, fontSize: 13, color: 'var(--ink-3)' }}>{t('pregame.loadingEvents')}</div>}
        {!loading && displayCandidates.length === 0 && <div style={{ padding: 16, fontSize: 13, color: 'var(--ink-3)' }}>{t('pregame.noEvents')}</div>}
        {displayCandidates.map(ev => {
          const out = excluded.has(ev.id)
          return (
            <div key={ev.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px',
              borderBottom: '1px solid var(--line)', opacity: out ? 0.45 : 1,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 9, flexShrink: 0, overflow: 'hidden',
                background: 'radial-gradient(120% 90% at 30% 10%, #8a6f50, #2a1f17 70%)',
              }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: out ? 'line-through' : 'none' }}>{eventTitle({ ...ev, description: '' })}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>
                  {formatYear(ev.year)}{ev.category ? ` · ${t('cat.' + ev.category)}` : ''}
                </div>
              </div>
              <button onClick={() => toggleExclude(ev.id)}
                aria-label={out ? t('pregame.restore') : t('pregame.exclude')}
                title={!out && excludeFull ? t('pregame.excludeLimitTitle', { n: excludeLimit }) : undefined}
                style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                  border: `1px solid ${out ? 'var(--ink)' : 'var(--line-strong)'}`,
                  background: out ? 'var(--ink)' : 'transparent',
                  color: out ? 'var(--paper-50)' : 'var(--ink-3)',
                  opacity: !out && excludeFull ? 0.4 : 1,
                }}>{out ? '↺' : '×'}</button>
            </div>
          )
        })}
      </div>
  )

  // Vyladit události (mobil) — řadicí hlavička + tělo seznamu
  const tuneList = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--surface)', borderTop: '1px solid var(--line)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{t('pregame.sort')}</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <SortBtn active={sortBy === 'year'} onClick={() => setSortBy('year')}>{t('pregame.sortYear')}</SortBtn>
          <SortBtn active={sortBy === 'title'} onClick={() => setSortBy('title')}>{t('pregame.sortTitle')}</SortBtn>
        </div>
      </div>
      {eventListBody}
    </>
  )

  const tuneCardMobile = (
    <div style={{ border: '1px solid var(--line-strong)', borderRadius: 12, overflow: 'hidden', marginBottom: 18 }}>
      <button onClick={() => setExpanded(e => !e)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
        padding: '14px', background: 'var(--surface)', border: 'none', cursor: 'pointer',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>🗂</span>
          <span style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 500 }}>{t('pregame.tune')}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
            {excluded.size > 0 ? t('pregame.away', { n: excluded.size }) : candidates.length}
          </span>
          <span style={{ color: 'var(--ink-3)', fontSize: 13, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
        </span>
      </button>
      {expanded && (
        <>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', padding: '0 14px 12px', background: 'var(--surface)' }}>
            {t('pregame.tuneHint')}
          </div>
          {tuneList}
        </>
      )}
    </div>
  )

  const startBtn = (
    <button onClick={start} disabled={!enough || loading} style={{
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      background: enough && !loading ? 'var(--accent)' : 'var(--paper-300)',
      color: '#fff', border: 'none', borderRadius: 14, padding: 16,
      fontFamily: 'var(--font-serif)', fontSize: 19, cursor: enough && !loading ? 'pointer' : 'not-allowed',
      boxShadow: enough && !loading ? '0 10px 30px rgba(217,119,87,0.4)' : 'none',
    }}>
      {t('pregame.start')}
      <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>→</span>
    </button>
  )

  const backBtn = (
    <button onClick={() => navigate('/menu')} aria-label={t('pregame.backToMenu')} style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
      background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
    }}>←</button>
  )

  // ── Desktop: layout dle mockupu (mřížka 2×2 + pravý rail) ──
  if (!isMobile) {
    const catName = (id: string) => t('cat.' + id).split(' ').slice(1).join(' ') || t('cat.' + id)
    const catSummary = categories.length === 0 ? t('pregame.allCats')
      : categories.length === 1 ? catName(categories[0]) : String(categories.length)

    const eraChip = (key: string, from?: number, to?: number, onClick?: () => void) => {
      const on = activeEra === key
      return (
        <button key={key} onClick={onClick} style={{
          padding: '8px 14px', borderRadius: 999, cursor: onClick ? 'pointer' : 'default',
          border: `1px solid ${on ? 'var(--ink)' : 'var(--line-strong)'}`,
          background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--paper-50)' : 'var(--ink-2)',
          fontFamily: 'var(--font-sans)', fontWeight: on ? 700 : 500, fontSize: 13, whiteSpace: 'nowrap',
        }}>{t('pregame.' + key)}</button>
      )
    }

    return (
      <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', paddingTop: isMobile ? 'var(--safe-top)' : 0, paddingBottom: 'max(28px, var(--safe-bottom))' }}>
        {!isMobile && <AppHeader/>}
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '14px 16px 0' : '30px 40px 0' }}>
          <PageHeader eyebrow={t('pregame.mode')} title={t('pregame.title')} onBack={() => navigate('/menu')}/>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.3fr) minmax(290px,1fr)', gap: 20, alignItems: 'start' }}>
            {/* ── Levý sloupec ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Počet kol + Období */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) minmax(0,2fr)', gap: 18 }}>
                <Card>
                  <CardLabel>{t('pregame.rounds')}</CardLabel>
                  {roundsCtl}
                </Card>
                <Card>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{t('pregame.period')}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink)' }}>{formatYear(lo)} — {formatYear(hi)}</span>
                  </div>
                  {yearCtl}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                    {ERAS.map(e => eraChip(e.key, e.from, e.to, () => { setYearFrom(e.from); setYearTo(e.to) }))}
                    {eraChip('eraCustom')}
                  </div>
                </Card>
              </div>

              {/* Kategorie */}
              <Card>
                <CardLabel hint={t('pregame.noFilter')}>{t('pregame.categories')}</CardLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {CAT_IDS.map(id => {
                    const on = categories.includes(id)
                    return (
                      <button key={id} onClick={() => toggleCategory(id)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 999, cursor: 'pointer',
                        border: `1px solid ${on ? 'var(--accent)' : 'var(--line-strong)'}`,
                        background: on ? 'rgba(217,119,87,0.09)' : 'transparent',
                        color: on ? 'var(--accent-deep)' : 'var(--ink-2)',
                        fontFamily: 'var(--font-sans)', fontWeight: on ? 700 : 500, fontSize: 13.5,
                      }}>
                        {t('cat.' + id)}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: on ? 'var(--accent)' : 'var(--ink-3)' }}>{catCounts[id] ?? 0}</span>
                      </button>
                    )
                  })}
                </div>
              </Card>

              {/* Události v losování */}
              <Card padding={0}>
                <div style={{ padding: '15px 18px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)' }}>{t('pregame.drawPool')}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{t('pregame.drawPoolSub')}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 999, background: 'var(--paper-200)', border: '1px solid var(--line)' }}>
                        <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>⌕</span>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('pregame.search')} style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink)', width: 110 }}/>
                      </div>
                      <SortBtn active={sortBy === 'year'} onClick={() => setSortBy('year')}>{t('pregame.sortYear')}</SortBtn>
                      <SortBtn active={sortBy === 'title'} onClick={() => setSortBy('title')}>{t('pregame.sortTitle')}</SortBtn>
                    </div>
                  </div>
                  <div style={{ height: 12 }}/>
                </div>
                {eventListBody}
              </Card>
            </div>

            {/* ── Pravý rail ── */}
            <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Card>
                <CardLabel>{t('pregame.yourGame')}</CardLabel>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 56, lineHeight: 1, letterSpacing: '-0.02em', color: enough ? 'var(--ink)' : 'var(--danger)' }}>{loading ? '…' : availableCount}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 120, lineHeight: 1.3 }}>{t('pregame.poolLabel')}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  <SummaryRow label={t('pregame.sumRounds')} value={String(rounds)}/>
                  <SummaryRow label={t('pregame.period')} value={t('pregame.' + activeEra)}/>
                  <SummaryRow label={t('pregame.sumCats')} value={catSummary}/>
                </div>
                {!enough && !loading && (
                  <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>⚠ {t('pregame.notEnough', { n: availableCount, min: rounds })}</div>
                )}
                {startBtn}
              </Card>

              {/* Pokročilé filtry */}
              <Card padding={0}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 15, color: isPremium ? 'var(--accent)' : 'var(--ink-3)' }}>♛</span>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)' }}>{t('pregame.advFilters')}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 999, background: isPremium ? 'var(--accent)' : 'var(--paper-300)', color: isPremium ? '#fff' : 'var(--ink-3)' }}>{isPremium ? t('pregame.active') : 'Premium'}</span>
                </div>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <PremiumRow icon="✦" label={t('pregame.onlyUnplayed').replace(/^\S+\s+/, '')} on={onlyUnplayed} locked={!caps.canUseSmartFilters}
                    onClick={() => { if (!caps.canUseSmartFilters) { setPresetMsg(t('pregame.lockUnplayed')); return } setOnlyUnplayed(v => !v) }}/>
                  <PremiumRow icon="◎" label={t('pregame.onlyMistakes').replace(/^\S+\s+/, '')} on={onlyMistakes} locked={!caps.canUseSmartFilters}
                    onClick={() => { if (!caps.canUseSmartFilters) { setPresetMsg(t('pregame.lockMistakes')); return } setOnlyMistakes(v => !v) }}/>
                  <PremiumRow icon="🔖" label={t('pregame.savePreset')} on={false} locked={!caps.canSavePresets}
                    onClick={async () => {
                      if (!caps.canSavePresets || !user) { setPresetMsg(t('pregame.presetsPremium')); return }
                      const name = window.prompt(t('pregame.presetNamePh') || 'Název scénáře')
                      if (!name?.trim()) return
                      const { data } = await createPreset(user.id, name.trim(), currentRules())
                      if (data) singlePlayerAnalytics.presetCreated((data as { id: string }).id, user.id)
                      setPresetMsg(t('pregame.presetSaved')); reloadPresets()
                    }}/>
                </div>
                {presetMsg && <div style={{ fontSize: 12, color: 'var(--accent-deep)', padding: '0 14px 14px' }}>{presetMsg}</div>}
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Mobil: původní jednosloupcový layout ───────────────────
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', display: 'flex', flexDirection: 'column', paddingTop: 'var(--safe-top)', paddingBottom: 'max(16px, var(--safe-bottom))' }}>
      <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 14px' }}>
          {backBtn}
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-deep)', marginBottom: 2 }}>{t('pregame.mode')}</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', letterSpacing: '-0.01em', margin: 0, lineHeight: 1.02 }}>{t('pregame.title')}</h1>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '8px 20px 0', maxWidth: 560, width: '100%', margin: '0 auto' }}>
        <Section label={t('pregame.rounds')}>{roundsCtl}</Section>
        <Section label={t('pregame.categories')} hint={t('pregame.noFilter')}>{categoriesCtl}</Section>
        <Section label={t('pregame.yearRange')}>{yearCtl}</Section>
        <Section label={t('pregame.smartFilters')} hint={caps.canUseSmartFilters ? undefined : 'Premium'}>{smartCtl}</Section>
        <Section label={t('pregame.presets')} hint={caps.canSavePresets ? undefined : 'Premium'}>{presetsCtl}</Section>
        <div style={{ marginBottom: 18 }}>{counterCtl}</div>
        {tuneCardMobile}
      </div>

      <div style={{ padding: '6px 20px 16px', maxWidth: 560, width: '100%', margin: '0 auto' }}>
        {startBtn}
      </div>
    </div>
  )
}

// ─── Desktop karta ────────────────────────────────────────
function Card({ children, padding = 20 }: { children: React.ReactNode; padding?: number }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding, overflow: 'hidden' }}>
      {children}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function PremiumRow({ icon, label, on, locked, onClick }: { icon: string; label: string; on: boolean; locked: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', cursor: 'pointer',
      padding: '11px 13px', borderRadius: 12,
      border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
      background: on ? 'rgba(217,119,87,0.09)' : 'var(--paper-100)',
    }}>
      <span style={{ fontSize: 15, color: on ? 'var(--accent)' : 'var(--ink-3)', width: 18, textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 13.5, color: locked ? 'var(--ink-3)' : 'var(--ink)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{locked ? '🔒' : on ? '✓' : ''}</span>
    </button>
  )
}

function CardLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{children}</span>
      {hint && <span style={{ fontSize: 11, color: 'var(--ink-3)', opacity: 0.7 }}>{hint}</span>}
    </div>
  )
}

// ─── Chytrý filtr (Premium) ───────────────────────────────
function SmartFilterChip({ label, on, enabled, onClick }: {
  label: string; on: boolean; enabled: boolean; count?: number; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 999,
      fontSize: 13, cursor: 'pointer',
      border: `1px solid ${on ? 'var(--accent)' : 'var(--line-strong)'}`,
      background: on ? 'var(--accent)' : 'transparent',
      color: on ? '#fff' : 'var(--ink-2)',
      opacity: enabled ? 1 : 0.55,
    }}>
      {label}
      {!enabled && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>♛</span>}
    </button>
  )
}

// ─── Scénáře (Premium) ────────────────────────────────────
function PresetBar({ presets, canUse, canShare, onLoad, onSave, onOverwrite, onDuplicate, onDelete, onShare, onPremium }: {
  presets: SinglePlayerPreset[]
  canUse: boolean
  canShare: boolean
  userId?: string
  onLoad: (r: PresetRules) => void
  onSave: (name: string) => Promise<void>
  onOverwrite: (p: SinglePlayerPreset) => Promise<void>
  onDuplicate: (p: SinglePlayerPreset) => Promise<void>
  onDelete: (p: SinglePlayerPreset) => Promise<void>
  onShare: (p: SinglePlayerPreset) => Promise<void>
  onPremium: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  if (!canUse) {
    return (
      <button onClick={onPremium} style={{
        width: '100%', textAlign: 'left', cursor: 'pointer', padding: '12px 14px', borderRadius: 12,
        background: 'var(--paper-100)', border: '1px dashed var(--line-strong)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>💾</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)' }}>{t('pregame.presetsCta')}</span>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>{t('pregame.presetsCtaSub')}</span>
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-deep)' }}>♛ PREMIUM</span>
      </button>
    )
  }

  const run = (fn: () => Promise<void>) => async () => { setBusy(true); await fn(); setBusy(false) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Uložení aktuálního nastavení */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" placeholder={t('pregame.presetNamePh')} value={name} maxLength={60}
          onChange={e => setName(e.target.value)} style={{ flex: 1 }}/>
        <button className="btn btn-accent" style={{ fontSize: 13, flexShrink: 0 }}
          disabled={busy || !name.trim()}
          onClick={run(async () => { await onSave(name.trim()); setName('') })}>{t('pregame.presetSave')}</button>
      </div>

      {presets.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{t('pregame.presetNone')}</div>
      )}

      {presets.map(p => (
        <div key={p.id} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 11,
          background: 'var(--surface)', border: '1px solid var(--line)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name}{p.is_shared && <span style={{ fontSize: 10, color: 'var(--accent-deep)', marginLeft: 6 }}>{t('pregame.presetShared')}</span>}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}>
              {t('pregame.presetRounds', { n: p.rules.rounds })}
              {p.rules.categories.length > 0 && t('pregame.presetCats', { n: p.rules.categories.length })}
              {p.rules.excludeIds.length > 0 && ` · −${p.rules.excludeIds.length}`}
              {p.rules.onlyUnplayed && t('pregame.sfxUnplayed')}
              {p.rules.onlyMistakes && t('pregame.sfxMistakes')}
            </div>
          </div>
          <button className="btn btn-ghost" style={miniBtn} disabled={busy} onClick={() => onLoad(p.rules)} title={t('pregame.presetLoad')}>▸</button>
          <button className="btn btn-ghost" style={miniBtn} disabled={busy} onClick={run(() => onOverwrite(p))} title={t('pregame.presetOverwrite')}>⟳</button>
          <button className="btn btn-ghost" style={miniBtn} disabled={busy} onClick={run(() => onDuplicate(p))} title={t('pregame.presetDuplicate')}>⧉</button>
          {canShare && (
            <button className="btn btn-ghost" style={miniBtn} disabled={busy} onClick={run(() => onShare(p))} title={p.is_shared ? t('pregame.unshare') : t('pregame.shareLink')}>
              {p.is_shared ? '🔗' : '↗'}
            </button>
          )}
          <button className="btn btn-ghost" style={{ ...miniBtn, color: 'var(--danger)' }} disabled={busy} onClick={run(() => onDelete(p))} title={t('pregame.presetDelete')}>✕</button>
        </div>
      ))}
    </div>
  )
}

const miniBtn: React.CSSProperties = { fontSize: 12, padding: '6px 8px', minWidth: 0, flexShrink: 0 }

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '18px 20px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{label}</span>
        <span style={{ flex: 1, height: 1, background: 'rgba(42,31,23,0.08)' }}/>
        {hint && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function SortBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 11.5, padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
      border: `1px solid ${active ? 'var(--ink)' : 'var(--line-strong)'}`,
      background: active ? 'var(--ink)' : 'transparent',
      color: active ? 'var(--paper-50)' : 'var(--ink-2)',
    }}>{children}</button>
  )
}

