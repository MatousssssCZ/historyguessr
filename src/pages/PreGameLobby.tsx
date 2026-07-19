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
import { useIsMobile } from '@/hooks/useIsMobile'
import type { GameOptions } from '@/hooks/useGame'

const CATEGORIES = [
  { id: 'war', label: '⚔ Války' },
  { id: 'moments', label: '📜 Historické okamžiky' },
  { id: 'places', label: '🧭 Objevy míst' },
  { id: 'inventions', label: '💡 Vynálezy' },
  { id: 'art', label: '🎨 Umění' },
  { id: 'sports', label: '🏅 Sportovní okamžiky' },
  { id: 'mysteries', label: '🔮 Záhady a legendy' },
  { id: 'disasters', label: '🌋 Katastrofy' },
]

const ROUND_OPTIONS = [3, 5, 10]

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
      if (!p) { setPresetMsg('Sdílený scénář nebyl nalezen nebo už není sdílený.'); return }
      applyRulesRef.current(p.rules)
      setPresetMsg(`Načten sdílený scénář „${p.name}"${p.owner_name ? ` od ${p.owner_name}` : ''}.`)
    }).catch(() => setPresetMsg('Sdílený scénář se nepodařilo načíst.'))
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
    else arr.sort((a, b) => a.title.localeCompare(b.title, 'cs'))
    return arr
  }, [filteredCandidates, sortBy])

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
        setPresetMsg(`Zdarma můžeš vyloučit ${excludeLimit} událostí. S Premium neomezeně.`)
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
    <div style={{ display: 'flex', background: 'var(--paper-200)', borderRadius: 12, padding: 4, gap: 4 }}>
      {ROUND_OPTIONS.map(r => (
        <button key={r} onClick={() => setRounds(r)} style={{
          flex: 1, border: 'none', padding: '9px 0', borderRadius: 9, cursor: 'pointer',
          fontFamily: 'var(--font-serif)', fontSize: 15,
          background: rounds === r ? 'var(--paper-50)' : 'transparent',
          color: rounds === r ? 'var(--ink)' : 'var(--ink-2)',
          fontWeight: rounds === r ? 500 : 400,
          boxShadow: rounds === r ? '0 1px 4px rgba(42,31,23,0.08)' : 'none',
        }}>{r}</button>
      ))}
    </div>
  )

  const categoriesCtl = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {CATEGORIES.map(cat => {
        const on = categories.includes(cat.id)
        return (
          <button key={cat.id} onClick={() => toggleCategory(cat.id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 999,
            fontSize: 13, cursor: 'pointer',
            border: `1px solid ${on ? 'var(--accent)' : 'var(--line-strong)'}`,
            background: on ? 'var(--accent)' : 'transparent',
            color: on ? '#fff' : 'var(--ink-2)',
          }}>{t('cat.' + cat.id)}</button>
        )
      })}
    </div>
  )

  const yearCtl = <YearRange from={yearFrom} to={yearTo} onFrom={setYearFrom} onTo={setYearTo}/>

  const smartCtl = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <SmartFilterChip
        label="🆕 Jen nehrané" on={onlyUnplayed} enabled={caps.canUseSmartFilters}
        onClick={() => {
          if (!caps.canUseSmartFilters) {
            singlePlayerAnalytics.premiumFilterAttempt('onlyUnplayed', user?.id)
            monetizationAnalytics.upsellShown('premium_single_player_feature', user?.id)
            setPresetMsg('Filtr „jen nehrané" je součástí Premium.')
            return
          }
          setOnlyUnplayed(v => !v)
        }}/>
      <SmartFilterChip
        label="🎯 Jen dříve chybné" on={onlyMistakes} enabled={caps.canUseSmartFilters}
        onClick={() => {
          if (!caps.canUseSmartFilters) {
            singlePlayerAnalytics.premiumFilterAttempt('onlyMistakes', user?.id)
            monetizationAnalytics.upsellShown('premium_single_player_feature', user?.id)
            setPresetMsg('Filtr „jen dříve chybné" je součástí Premium.')
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
        onLoad={(r) => { applyRules(r); setPresetMsg('Scénář načten.') }}
        onSave={async (name) => {
          if (!user) return
          const { data } = await createPreset(user.id, name, currentRules())
          if (data) singlePlayerAnalytics.presetCreated((data as { id: string }).id, user.id)
          setPresetMsg('Scénář uložen.'); reloadPresets()
        }}
        onOverwrite={async (p) => {
          await updatePreset(p.id, { rules: currentRules() })
          setPresetMsg('Scénář přepsán aktuálním nastavením.'); reloadPresets()
        }}
        onDuplicate={async (p) => {
          if (!user) return
          await createPreset(user.id, `${p.name} (kopie)`, p.rules)
          setPresetMsg('Scénář duplikován.'); reloadPresets()
        }}
        onDelete={async (p) => {
          if (!confirm(`Smazat scénář „${p.name}"?`)) return
          await deletePreset(p.id); setPresetMsg('Scénář smazán.'); reloadPresets()
        }}
        onShare={async (p) => {
          try {
            const slug = await setPresetShared(p.id, !p.is_shared)
            if (slug) {
              const url = `${window.location.origin}/play?preset=${slug}`
              await navigator.clipboard?.writeText(url).catch(() => {})
              singlePlayerAnalytics.presetShared(p.id, user?.id)
              setPresetMsg('Odkaz zkopírován do schránky.')
            } else setPresetMsg('Sdílení vypnuto.')
            reloadPresets()
          } catch { setPresetMsg('Sdílení se nepodařilo.') }
        }}
        onPremium={() => {
          monetizationAnalytics.upsellShown('premium_single_player_feature', user?.id)
          setPresetMsg('Ukládání scénářů je součástí Premium.')
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

  // Vyladit události — na desktopu vždy rozbaleno (bez skládací hlavičky)
  const tuneList = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--surface)', borderTop: '1px solid var(--line)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{t('pregame.sort')}</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <SortBtn active={sortBy === 'year'} onClick={() => setSortBy('year')}>{t('pregame.sortYear')}</SortBtn>
          <SortBtn active={sortBy === 'title'} onClick={() => setSortBy('title')}>{t('pregame.sortTitle')}</SortBtn>
        </div>
      </div>
      <div style={{ maxHeight: isMobile ? 320 : 460, overflowY: 'auto', borderTop: '1px solid var(--line)' }}>
        {loading && <div style={{ padding: 16, fontSize: 13, color: 'var(--ink-3)' }}>{t('pregame.loadingEvents')}</div>}
        {!loading && sortedCandidates.length === 0 && <div style={{ padding: 16, fontSize: 13, color: 'var(--ink-3)' }}>{t('pregame.noEvents')}</div>}
        {sortedCandidates.map(ev => {
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
                title={!out && excludeFull ? `Zdarma lze vyloučit ${excludeLimit} událostí — s Premium neomezeně` : undefined}
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

  // ── Desktop: přehledný dvousloupcový layout ────────────────
  if (!isMobile) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', paddingTop: 'var(--safe-top)', paddingBottom: 'max(24px, var(--safe-bottom))' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 32px 0' }}>
          {/* Hlavička */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            {backBtn}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent-deep)', marginBottom: 3 }}>{t('pregame.mode')}</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 34, color: 'var(--ink)', letterSpacing: '-0.015em', margin: 0, lineHeight: 1 }}>{t('pregame.title')}</h1>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.55fr) minmax(320px,1fr)', gap: 24, alignItems: 'start' }}>
            {/* Levý sloupec — nastavení */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Card>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                  <div>
                    <CardLabel>{t('pregame.rounds')}</CardLabel>
                    {roundsCtl}
                  </div>
                  <div>
                    <CardLabel>{t('pregame.yearRange')}</CardLabel>
                    <div style={{ paddingTop: 4 }}>{yearCtl}</div>
                  </div>
                </div>
                <div style={{ marginTop: 22 }}>
                  <CardLabel hint={t('pregame.noFilter')}>{t('pregame.categories')}</CardLabel>
                  {categoriesCtl}
                </div>
              </Card>

              <Card padding={0}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px' }}>
                  <span style={{ fontSize: 16 }}>🗂</span>
                  <span style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 500 }}>{t('pregame.tune')}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
                    {excluded.size > 0 ? t('pregame.away', { n: excluded.size }) : candidates.length}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', padding: '0 18px 12px' }}>{t('pregame.tuneHint')}</div>
                {tuneList}
              </Card>
            </div>

            {/* Pravý sloupec — shrnutí + Premium */}
            <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Card>
                <CardLabel>{t('pregame.mode')}</CardLabel>
                <div style={{ marginBottom: 14 }}>{counterCtl}</div>
                {startBtn}
              </Card>

              {/* Premium nástroje — vizuálně odlišený panel */}
              <div style={{
                borderRadius: 16, overflow: 'hidden',
                border: `1px solid ${isPremium ? 'var(--accent)' : 'var(--line-strong)'}`,
                background: 'var(--surface)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px',
                  background: isPremium ? 'linear-gradient(150deg,rgba(217,119,87,0.14),rgba(217,119,87,0.04))' : 'var(--paper-200)',
                  borderBottom: '1px solid var(--line)',
                }}>
                  <span style={{ fontSize: 15 }}>♛</span>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)' }}>Pokročilé nástroje</span>
                  <span style={{
                    marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
                    textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999,
                    background: isPremium ? 'var(--accent)' : 'var(--paper-300)',
                    color: isPremium ? '#fff' : 'var(--ink-3)',
                  }}>{isPremium ? 'Aktivní' : 'Premium'}</span>
                </div>
                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {!isPremium && (
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                      Chytré filtry a ukládání scénářů jsou součástí Premium. Vyzkoušet je můžeš i teď — zobrazíme, co odemkneš.
                    </div>
                  )}
                  <div>
                    <CardLabel>Chytré filtry</CardLabel>
                    {smartCtl}
                  </div>
                  <div>
                    <CardLabel>Scénáře</CardLabel>
                    {presetsCtl}
                  </div>
                </div>
              </div>
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
        <Section label="Chytré filtry" hint={caps.canUseSmartFilters ? undefined : 'Premium'}>{smartCtl}</Section>
        <Section label="Scénáře" hint={caps.canSavePresets ? undefined : 'Premium'}>{presetsCtl}</Section>
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
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)' }}>Ulož si nastavení jako scénář</span>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>Rychlé opakované spuštění · Premium</span>
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
        <input className="input" placeholder="Název scénáře…" value={name} maxLength={60}
          onChange={e => setName(e.target.value)} style={{ flex: 1 }}/>
        <button className="btn btn-accent" style={{ fontSize: 13, flexShrink: 0 }}
          disabled={busy || !name.trim()}
          onClick={run(async () => { await onSave(name.trim()); setName('') })}>Uložit</button>
      </div>

      {presets.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Zatím žádné scénáře.</div>
      )}

      {presets.map(p => (
        <div key={p.id} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 11,
          background: 'var(--surface)', border: '1px solid var(--line)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name}{p.is_shared && <span style={{ fontSize: 10, color: 'var(--accent-deep)', marginLeft: 6 }}>· sdílený</span>}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}>
              {p.rules.rounds} kol
              {p.rules.categories.length > 0 && ` · ${p.rules.categories.length} kat.`}
              {p.rules.excludeIds.length > 0 && ` · −${p.rules.excludeIds.length}`}
              {p.rules.onlyUnplayed && ' · nehrané'}
              {p.rules.onlyMistakes && ' · chybné'}
            </div>
          </div>
          <button className="btn btn-ghost" style={miniBtn} disabled={busy} onClick={() => onLoad(p.rules)} title="Načíst">▸</button>
          <button className="btn btn-ghost" style={miniBtn} disabled={busy} onClick={run(() => onOverwrite(p))} title="Přepsat aktuálním nastavením">⟳</button>
          <button className="btn btn-ghost" style={miniBtn} disabled={busy} onClick={run(() => onDuplicate(p))} title="Duplikovat">⧉</button>
          {canShare && (
            <button className="btn btn-ghost" style={miniBtn} disabled={busy} onClick={run(() => onShare(p))} title={p.is_shared ? 'Zrušit sdílení' : 'Sdílet odkazem'}>
              {p.is_shared ? '🔗' : '↗'}
            </button>
          )}
          <button className="btn btn-ghost" style={{ ...miniBtn, color: 'var(--danger)' }} disabled={busy} onClick={run(() => onDelete(p))} title="Smazat">✕</button>
        </div>
      ))}
    </div>
  )
}

const miniBtn: React.CSSProperties = { fontSize: 12, padding: '6px 8px', minWidth: 0, flexShrink: 0 }

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{label}</span>
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

